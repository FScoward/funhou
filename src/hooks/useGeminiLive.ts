/**
 * Gemini Live 対話フック
 * - WebSocket通信、音声入出力を統合
 * - 状態管理
 * - Web Audio APIでマイク入力を取得しPCM音声を直接送信
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { GeminiLiveClient } from '@/lib/geminiLive'
import { AudioInputProcessor, AudioOutputProcessor } from '@/lib/audioProcessor'
import type {
  GeminiLiveConfig,
  GeminiLiveState,
  GeminiLiveDialogMessage,
} from '@/types/geminiLive'

interface UseGeminiLiveOptions {
  config: GeminiLiveConfig
  onError?: (error: Error) => void
}

interface UseGeminiLiveReturn {
  /** 現在の状態 */
  state: GeminiLiveState
  /** エラーメッセージ */
  error: string | null
  /** 対話メッセージ履歴 */
  messages: GeminiLiveDialogMessage[]
  /** 現在のユーザー発話テキスト（リアルタイム認識結果） */
  currentTranscript: string
  /** 現在のAI応答テキスト */
  currentResponse: string
  /** セッション開始 */
  startSession: () => Promise<void>
  /** セッション終了 */
  endSession: () => void
  /** テキストメッセージ送信 */
  sendTextMessage: (text: string) => void
  /** 接続中かどうか */
  isConnected: boolean
  /** リスニング中かどうか */
  isListening: boolean
  /** 応答中かどうか */
  isSpeaking: boolean
  /** メッセージ履歴をクリア */
  clearMessages: () => void
}

export function useGeminiLive({
  config,
  onError,
}: UseGeminiLiveOptions): UseGeminiLiveReturn {
  const [state, setState] = useState<GeminiLiveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<GeminiLiveDialogMessage[]>([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [currentResponse, setCurrentResponse] = useState('')

  const clientRef = useRef<GeminiLiveClient | null>(null)
  const inputRef = useRef<AudioInputProcessor | null>(null)
  const outputRef = useRef<AudioOutputProcessor | null>(null)

  // ストリーミング中のトランスクリプトを累積するためのref
  const accumulatedInputRef = useRef<string>('')
  const accumulatedOutputRef = useRef<string>('')

  // メッセージを追加
  const addMessage = useCallback(
    (role: 'user' | 'assistant', content: string) => {
      const message: GeminiLiveDialogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, message])
    },
    []
  )

  // セッション開始
  const startSession = useCallback(async () => {
    if (!config.apiKey) {
      const err = new Error('APIキーが設定されていません')
      setError(err.message)
      onError?.(err)
      return
    }

    setError(null)
    setState('connecting')

    try {
      // 音声出力プロセッサを初期化
      outputRef.current = new AudioOutputProcessor()

      // Gemini Live クライアントを初期化
      const client = new GeminiLiveClient(config, {
        onSetupComplete: () => {
          console.log('Gemini Live setup complete')
          setState('listening')
          // セットアップ完了後にマイク入力を開始
          startAudioInput()
        },
        onAudioReceived: (audioData) => {
          outputRef.current?.enqueue(audioData)
        },
        onTextReceived: (text) => {
          setCurrentResponse((prev) => prev + text)
        },
        onTranscript: (text) => {
          // 入力トランスクリプトを累積
          accumulatedInputRef.current += text
          setCurrentTranscript(accumulatedInputRef.current)
        },
        onOutputTranscript: (text) => {
          // 出力トランスクリプトを累積してリアルタイム表示
          accumulatedOutputRef.current += text
          setCurrentResponse(accumulatedOutputRef.current)
        },
        onTurnComplete: () => {
          // ターン完了時に累積したテキストをメッセージ履歴に追加
          if (accumulatedInputRef.current.trim()) {
            addMessage('user', accumulatedInputRef.current.trim())
          }
          if (accumulatedOutputRef.current.trim()) {
            addMessage('assistant', accumulatedOutputRef.current.trim())
          }
          // リセット
          accumulatedInputRef.current = ''
          accumulatedOutputRef.current = ''
          setCurrentTranscript('')
          setCurrentResponse('')
          setState('listening')
        },
        onInterrupted: () => {
          // 割り込み時は音声再生を停止
          outputRef.current?.interrupt()
          // 割り込み時も累積したテキストがあれば履歴に追加
          if (accumulatedInputRef.current.trim()) {
            addMessage('user', accumulatedInputRef.current.trim())
          }
          if (accumulatedOutputRef.current.trim()) {
            addMessage('assistant', accumulatedOutputRef.current.trim() + '...(中断)')
          }
          // リセット
          accumulatedInputRef.current = ''
          accumulatedOutputRef.current = ''
          setCurrentTranscript('')
          setCurrentResponse('')
          setState('listening')
        },
        onError: (err) => {
          setError(err.message)
          onError?.(err)
        },
        onStateChange: (newState) => {
          setState(newState)
        },
      })

      clientRef.current = client
      await client.connect()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error.message)
      setState('error')
      onError?.(error)
    }
  }, [config, onError, addMessage])

  // マイク入力を開始
  const startAudioInput = useCallback(async () => {
    try {
      inputRef.current = new AudioInputProcessor()
      inputRef.current.onAudioData = (pcmData) => {
        // PCM音声データをGemini Live APIに送信
        if (clientRef.current) {
          clientRef.current.sendAudio(pcmData)
        }
      }
      await inputRef.current.start()
      console.log('Microphone input started')
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error('Failed to start microphone:', error)
      setError(`マイクへのアクセスに失敗しました: ${error.message}`)
      onError?.(error)
    }
  }, [onError])

  // マイク入力を停止
  const stopAudioInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.stop()
      inputRef.current = null
      console.log('Microphone input stopped')
    }
  }, [])

  // セッション終了
  const endSession = useCallback(() => {
    // マイク入力を停止
    stopAudioInput()

    // 音声出力を停止
    if (outputRef.current) {
      outputRef.current.dispose()
      outputRef.current = null
    }

    // WebSocket接続を閉じる
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }

    setState('idle')
    setCurrentTranscript('')
    setCurrentResponse('')
  }, [stopAudioInput])

  // テキストメッセージを送信
  const sendTextMessage = useCallback(
    (text: string) => {
      if (!clientRef.current || !text.trim()) {
        return
      }

      // 履歴に追加
      addMessage('user', text)
      setCurrentTranscript('')

      // 送信
      clientRef.current.sendText(text)
      setState('processing')
    },
    [addMessage]
  )

  // メッセージ履歴をクリア
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // クリーンアップ
  useEffect(() => {
    return () => {
      endSession()
    }
  }, [endSession])

  return {
    state,
    error,
    messages,
    currentTranscript,
    currentResponse,
    startSession,
    endSession,
    sendTextMessage,
    isConnected: state !== 'idle' && state !== 'error',
    isListening: state === 'listening',
    isSpeaking: state === 'speaking',
    clearMessages,
  }
}
