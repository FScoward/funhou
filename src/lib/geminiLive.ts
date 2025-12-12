/**
 * Gemini Live API WebSocket クライアント
 */

import type {
  GeminiLiveConfig,
  GeminiLiveRealtimeInputMessage,
  GeminiLiveServerMessage,
  GeminiLiveEventHandlers,
  GeminiLiveState,
} from '@/types/geminiLive'

// Gemini Live API エンドポイント
const GEMINI_LIVE_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

// ArrayBufferをBase64に変換
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Base64をArrayBufferに変換
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Gemini Live API クライアント
 */
export class GeminiLiveClient {
  private ws: WebSocket | null = null
  private config: GeminiLiveConfig
  private handlers: GeminiLiveEventHandlers
  private state: GeminiLiveState = 'idle'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor(config: GeminiLiveConfig, handlers: GeminiLiveEventHandlers = {}) {
    this.config = config
    this.handlers = handlers
  }

  /**
   * 現在の状態を取得
   */
  getState(): GeminiLiveState {
    return this.state
  }

  /**
   * 状態を更新してイベントを発火
   */
  private setState(newState: GeminiLiveState): void {
    this.state = newState
    this.handlers.onStateChange?.(newState)
  }

  /**
   * WebSocket接続を開始
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('Already connected')
      return
    }

    if (!this.config.apiKey) {
      const error = new Error('API key is required')
      this.handlers.onError?.(error)
      this.setState('error')
      throw error
    }

    this.setState('connecting')

    const url = `${GEMINI_LIVE_ENDPOINT}?key=${this.config.apiKey}`

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          console.log('WebSocket connected, sending setup...')
          this.sendSetup()
          this.reconnectAttempts = 0
        }

        this.ws.onmessage = async (event) => {
          // Blobの場合はテキストに変換
          if (event.data instanceof Blob) {
            const text = await event.data.text()
            this.handleMessage(text)
          } else if (typeof event.data === 'string') {
            this.handleMessage(event.data)
          } else {
            console.warn('Unknown message type:', typeof event.data)
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.handlers.onError?.(new Error('WebSocket connection error'))
          this.setState('error')
          reject(error)
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          if (this.state !== 'idle' && this.state !== 'error') {
            this.handleDisconnect()
          }
        }

        // タイムアウト処理
        const timeout = setTimeout(() => {
          if (this.state === 'connecting') {
            this.ws?.close()
            reject(new Error('Connection timeout'))
          }
        }, 10000)

        // ready状態になったら解決
        const originalHandler = this.handlers.onSetupComplete
        this.handlers.onSetupComplete = () => {
          clearTimeout(timeout)
          originalHandler?.()
          resolve()
        }
      } catch (error) {
        this.setState('error')
        reject(error)
      }
    })
  }

  /**
   * セットアップメッセージを送信
   */
  private sendSetup(): void {
    const setup = {
      setup: {
        model: this.config.model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: this.config.voiceConfig?.voiceName
            ? {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: this.config.voiceConfig.voiceName,
                  },
                },
              }
            : undefined,
        },
        systemInstruction: this.config.systemInstruction
          ? {
              parts: [{ text: this.config.systemInstruction }],
            }
          : undefined,
        // 入力音声のトランスクリプションを有効化
        inputAudioTranscription: {},
        // 出力音声のトランスクリプションを有効化
        outputAudioTranscription: {},
      },
    }

    console.log('Sending setup message:', JSON.stringify(setup, null, 2))
    this.send(setup)
  }

  /**
   * メッセージを送信
   */
  private send(data: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not open')
      return
    }
    this.ws.send(JSON.stringify(data))
  }

  /**
   * サーバーからのメッセージを処理
   */
  private handleMessage(data: string): void {
    try {
      // デバッグ用: 受信データの先頭を表示
      console.log('Received message preview:', data.substring(0, 200))

      const message: GeminiLiveServerMessage = JSON.parse(data)

      // セットアップ完了
      if ('setupComplete' in message) {
        console.log('Setup complete')
        this.setState('ready')
        this.handlers.onSetupComplete?.()
        return
      }

      // サーバーコンテンツ
      if ('serverContent' in message) {
        const { serverContent } = message as { serverContent: {
          interrupted?: boolean
          modelTurn?: { parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }
          turnComplete?: boolean
          inputTranscription?: { text: string }
          outputTranscription?: { text: string }
        }}

        // 割り込み
        if (serverContent.interrupted) {
          console.log('Response interrupted')
          this.handlers.onInterrupted?.()
          this.setState('listening')
          return
        }

        // 入力トランスクリプション（ユーザーの発話テキスト）
        if (serverContent.inputTranscription?.text) {
          console.log('Input transcription:', serverContent.inputTranscription.text)
          this.handlers.onTranscript?.(serverContent.inputTranscription.text)
        }

        // 出力トランスクリプション（AIの応答テキスト）
        if (serverContent.outputTranscription?.text) {
          console.log('Output transcription:', serverContent.outputTranscription.text)
          // 履歴追加用（完了したトランスクリプトとして）
          this.handlers.onOutputTranscript?.(serverContent.outputTranscription.text)
        }

        // モデルの応答
        if (serverContent.modelTurn?.parts) {
          for (const part of serverContent.modelTurn.parts) {
            // テキスト応答（モデルからの直接テキスト）
            if (part.text) {
              this.handlers.onTextReceived?.(part.text)
            }

            // 音声応答
            if (part.inlineData?.data) {
              const audioData = base64ToArrayBuffer(part.inlineData.data)
              this.setState('speaking')
              this.handlers.onAudioReceived?.(audioData)
            }
          }
        }

        // ターン完了
        if (serverContent.turnComplete) {
          console.log('Turn complete')
          this.handlers.onTurnComplete?.()
          this.setState('listening')
        }
        return
      }

      // ツール呼び出し（将来の拡張用）
      if ('toolCall' in message) {
        console.log('Tool call received:', message.toolCall)
        return
      }

      console.log('Unknown message type:', message)
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  }

  /**
   * 音声データを送信
   */
  sendAudio(audioData: ArrayBuffer): void {
    // speaking状態でも送信可能（割り込みのため）
    if (this.state !== 'ready' && this.state !== 'listening' && this.state !== 'speaking') {
      console.warn('Not ready to send audio, state:', this.state)
      return
    }

    const message: GeminiLiveRealtimeInputMessage = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: arrayBufferToBase64(audioData),
          },
        ],
      },
    }

    this.send(message)
    // speaking中に送信した場合は状態を変えない（interrupted イベントを待つ）
    if (this.state !== 'speaking') {
      this.setState('listening')
    }
  }

  /**
   * テキストメッセージを送信
   */
  sendText(text: string): void {
    if (this.state !== 'ready' && this.state !== 'listening') {
      console.warn('Not ready to send text, current state:', this.state)
      return
    }

    const message = {
      clientContent: {
        turns: [
          {
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    }

    console.log('Sending text message:', JSON.stringify(message))
    this.send(message)
    this.setState('processing')
  }

  /**
   * 切断処理
   */
  private handleDisconnect(): void {
    if (
      this.reconnectAttempts < this.maxReconnectAttempts &&
      this.state !== 'idle'
    ) {
      this.reconnectAttempts++
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      )
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts)
    } else {
      this.setState('error')
      this.handlers.onError?.(new Error('Connection lost'))
    }
  }

  /**
   * 接続を閉じる
   */
  disconnect(): void {
    this.setState('idle')
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * イベントハンドラを更新
   */
  updateHandlers(handlers: Partial<GeminiLiveEventHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers }
  }
}
