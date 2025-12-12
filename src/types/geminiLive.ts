/**
 * Gemini Live API 型定義
 */

// Gemini Live 対話の状態
export type GeminiLiveState =
  | 'idle' // 待機中
  | 'connecting' // 接続中
  | 'ready' // 接続完了、対話可能
  | 'listening' // 音声入力中（ユーザーが話している）
  | 'processing' // Geminiが処理中
  | 'speaking' // Geminiが応答中（音声出力中）
  | 'error' // エラー発生

// Gemini Live 設定
export interface GeminiLiveConfig {
  apiKey: string
  model: string
  systemInstruction?: string
  voiceConfig?: {
    voiceName?: string
  }
}

// WebSocketメッセージ: セットアップ
export interface GeminiLiveSetupMessage {
  setup: {
    model: string
    generationConfig: {
      responseModalities: ('AUDIO' | 'TEXT')[]
      speechConfig?: {
        voiceConfig?: {
          prebuiltVoiceConfig?: {
            voiceName: string
          }
        }
      }
    }
    systemInstruction?: {
      parts: { text: string }[]
    }
  }
}

// WebSocketメッセージ: リアルタイム入力（音声）
export interface GeminiLiveRealtimeInputMessage {
  realtimeInput: {
    mediaChunks: {
      mimeType: string
      data: string // Base64エンコードされた音声データ
    }[]
  }
}

// WebSocketメッセージ: クライアントコンテンツ（テキスト）
export interface GeminiLiveClientContentMessage {
  clientContent: {
    turns: {
      role: 'user'
      parts: { text: string }[]
    }[]
    turnComplete: boolean
  }
}

// サーバーからのレスポンス: セットアップ完了
export interface GeminiLiveSetupCompleteResponse {
  setupComplete: Record<string, unknown>
}

// サーバーからのレスポンス: サーバーコンテンツ
export interface GeminiLiveServerContentResponse {
  serverContent: {
    modelTurn?: {
      parts: {
        text?: string
        inlineData?: {
          mimeType: string
          data: string // Base64エンコードされた音声データ
        }
      }[]
    }
    turnComplete?: boolean
    interrupted?: boolean
  }
}

// サーバーからのレスポンス: ツール呼び出し（将来の拡張用）
export interface GeminiLiveToolCallResponse {
  toolCall: {
    functionCalls: {
      name: string
      args: Record<string, unknown>
    }[]
  }
}

// サーバーレスポンスの統合型
export type GeminiLiveServerMessage =
  | GeminiLiveSetupCompleteResponse
  | GeminiLiveServerContentResponse
  | GeminiLiveToolCallResponse

// イベントハンドラ型
export interface GeminiLiveEventHandlers {
  onSetupComplete?: () => void
  onAudioReceived?: (audioData: ArrayBuffer) => void
  onTextReceived?: (text: string) => void
  /** ユーザーの発話テキスト（入力トランスクリプション）- ストリーミングで部分的に届く */
  onTranscript?: (text: string) => void
  /** AIの応答テキスト（出力トランスクリプション） - 完了したテキストとして直接履歴に追加用 */
  onOutputTranscript?: (text: string) => void
  onTurnComplete?: () => void
  onInterrupted?: () => void
  onError?: (error: Error) => void
  onStateChange?: (state: GeminiLiveState) => void
}

// 対話メッセージ（UI表示用）
export interface GeminiLiveDialogMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// 設定保存用の型（settings.tsで使用）
export interface GeminiSettings {
  geminiApiKey?: string
  geminiModel?: string
  geminiVoice?: string
  geminiSystemPrompt?: string
}

// 利用可能なモデル
export const GEMINI_LIVE_MODELS = [
  {
    id: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
    name: 'Gemini 2.5 Flash Native Audio',
    description: 'リアルタイム双方向音声対話向け',
  },
] as const

// デフォルトモデル
export const DEFAULT_GEMINI_MODEL =
  'models/gemini-2.5-flash-native-audio-preview-09-2025'

// 利用可能な音声（抜粋）
export const GEMINI_VOICES = [
  { id: 'Puck', name: 'Puck', description: '活発で元気な声' },
  { id: 'Charon', name: 'Charon', description: '落ち着いた低めの声' },
  { id: 'Kore', name: 'Kore', description: '明るく親しみやすい声' },
  { id: 'Fenrir', name: 'Fenrir', description: '深みのある声' },
  { id: 'Aoede', name: 'Aoede', description: '柔らかく穏やかな声' },
] as const

// デフォルト音声
export const DEFAULT_GEMINI_VOICE = 'Puck'
