/** 音声認識の状態 */
export type SpeechRecognitionState =
  | 'Idle'
  | 'Listening'
  | 'Processing'
  | 'Error'

/** 認識結果 */
export interface RecognitionResult {
  /** 認識されたテキスト */
  text: string
  /** 確定かどうか */
  is_final: boolean
}
