import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import type { SpeechRecognitionState, RecognitionResult } from '@/types/speech'

interface UseSpeechRecognitionProps {
  /** 認識結果を受け取るコールバック */
  onResult?: (text: string, isFinal: boolean) => void
  /** エラー発生時のコールバック */
  onError?: (error: string) => void
}

interface UseSpeechRecognitionReturn {
  /** 現在の認識状態 */
  state: SpeechRecognitionState
  /** リスニング中かどうか */
  isListening: boolean
  /** 音声認識が利用可能かどうか */
  isAvailable: boolean
  /** 音声認識を開始 */
  startRecognition: () => Promise<void>
  /** 音声認識を停止 */
  stopRecognition: () => Promise<void>
  /** 音声認識を開始/停止トグル */
  toggleRecognition: () => Promise<void>
}

export function useSpeechRecognition({
  onResult,
  onError,
}: UseSpeechRecognitionProps = {}): UseSpeechRecognitionReturn {
  const [state, setState] = useState<SpeechRecognitionState>('Idle')
  const [isAvailable, setIsAvailable] = useState(true)

  // コールバックをrefで保持して最新の値を参照できるようにする
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
  }, [onResult, onError])

  // 状態変更イベントと認識結果イベントをリッスン
  useEffect(() => {
    let unlistenState: UnlistenFn | undefined
    let unlistenResult: UnlistenFn | undefined

    const setupListeners = async () => {
      // 状態変更イベント
      unlistenState = await listen<SpeechRecognitionState>(
        'speech-state-changed',
        (event) => {
          setState(event.payload)
        }
      )

      // 認識結果イベント
      unlistenResult = await listen<RecognitionResult>(
        'speech-recognition-result',
        (event) => {
          if (onResultRef.current) {
            onResultRef.current(event.payload.text, event.payload.is_final)
          }
        }
      )
    }

    setupListeners()

    return () => {
      unlistenState?.()
      unlistenResult?.()
    }
  }, [])

  // 音声認識を開始
  const startRecognition = useCallback(async () => {
    try {
      await invoke('start_speech_recognition')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      onErrorRef.current?.(errorMessage)
      setState('Error')

      // 利用不可の場合はフラグを更新
      if (errorMessage.includes('not available')) {
        setIsAvailable(false)
      }
    }
  }, [])

  // 音声認識を停止
  const stopRecognition = useCallback(async () => {
    try {
      await invoke('stop_speech_recognition')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      onErrorRef.current?.(errorMessage)
    }
  }, [])

  // トグル
  const toggleRecognition = useCallback(async () => {
    if (state === 'Listening') {
      await stopRecognition()
    } else {
      await startRecognition()
    }
  }, [state, startRecognition, stopRecognition])

  return {
    state,
    isListening: state === 'Listening',
    isAvailable,
    startRecognition,
    stopRecognition,
    toggleRecognition,
  }
}
