use serde::{Deserialize, Serialize};

/// 音声認識の状態
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum SpeechRecognitionState {
    /// アイドル（停止中）
    #[default]
    Idle,
    /// リスニング中
    Listening,
    /// 処理中
    Processing,
    /// エラー
    Error,
}

/// 音声認識設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechConfig {
    /// 有効かどうか
    pub enabled: bool,
    /// 認識言語（ja-JP等）
    pub language: String,
}

impl Default for SpeechConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            language: "ja-JP".to_string(),
        }
    }
}

/// 認識結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecognitionResult {
    /// 認識されたテキスト
    pub text: String,
    /// 確定かどうか
    pub is_final: bool,
}
