use std::sync::Mutex;
use tauri::Emitter;

use crate::speech::config::{RecognitionResult, SpeechConfig, SpeechRecognitionState};
use crate::speech::recognizer::SpeechRecognizerWrapper;

/// 音声認識マネージャー
pub struct SpeechManager {
    config: Mutex<SpeechConfig>,
    state: Mutex<SpeechRecognitionState>,
    recognizer: Mutex<Option<SpeechRecognizerWrapper>>,
}

impl SpeechManager {
    /// 新しいSpeechManagerを作成
    pub fn new() -> Self {
        Self {
            config: Mutex::new(SpeechConfig::default()),
            state: Mutex::new(SpeechRecognitionState::Idle),
            recognizer: Mutex::new(None),
        }
    }

    /// 音声認識を開始
    pub fn start_recognition<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
    ) -> Result<(), String> {
        // 現在の状態をチェック
        {
            let state = self.state.lock().map_err(|e| e.to_string())?;
            if *state == SpeechRecognitionState::Listening {
                return Err("Already listening".to_string());
            }
        }

        // 設定を取得
        let language = {
            let config = self.config.lock().map_err(|e| e.to_string())?;
            config.language.clone()
        };

        // 認識器を初期化
        let mut recognizer_guard = self.recognizer.lock().map_err(|e| e.to_string())?;
        if recognizer_guard.is_none() {
            *recognizer_guard = Some(SpeechRecognizerWrapper::new(&language)?);
        }

        // コールバックを設定して開始
        let app_handle = app.clone();
        if let Some(ref recognizer) = *recognizer_guard {
            recognizer.start_listening(move |result: RecognitionResult| {
                println!("[SpeechManager] Emitting result: '{}' (final: {})", result.text, result.is_final);
                // フロントエンドにイベント送信
                if let Err(e) = app_handle.emit("speech-recognition-result", &result) {
                    eprintln!("[SpeechManager] Failed to emit event: {}", e);
                }
            })?;
        }

        // 状態を更新
        {
            let mut state = self.state.lock().map_err(|e| e.to_string())?;
            *state = SpeechRecognitionState::Listening;
        }

        // 状態変更イベント送信
        app.emit("speech-state-changed", SpeechRecognitionState::Listening)
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// 音声認識を停止
    pub fn stop_recognition<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
    ) -> Result<(), String> {
        // 認識器を停止
        {
            let recognizer_guard = self.recognizer.lock().map_err(|e| e.to_string())?;
            if let Some(ref recognizer) = *recognizer_guard {
                recognizer.stop_listening()?;
            }
        }

        // 状態を更新
        {
            let mut state = self.state.lock().map_err(|e| e.to_string())?;
            *state = SpeechRecognitionState::Idle;
        }

        // 状態変更イベント送信
        app.emit("speech-state-changed", SpeechRecognitionState::Idle)
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// 現在の状態を取得
    pub fn get_state(&self) -> Result<SpeechRecognitionState, String> {
        let state = self.state.lock().map_err(|e| e.to_string())?;
        Ok(*state)
    }

    /// 設定を取得
    #[allow(dead_code)]
    pub fn get_config(&self) -> Result<SpeechConfig, String> {
        let config = self.config.lock().map_err(|e| e.to_string())?;
        Ok(config.clone())
    }

    /// 言語を設定
    #[allow(dead_code)]
    pub fn set_language(&self, language: String) -> Result<(), String> {
        let mut config = self.config.lock().map_err(|e| e.to_string())?;
        config.language = language;

        // 認識器をリセット（次回開始時に新しい言語で初期化される）
        let mut recognizer = self.recognizer.lock().map_err(|e| e.to_string())?;
        *recognizer = None;

        Ok(())
    }
}

impl Default for SpeechManager {
    fn default() -> Self {
        Self::new()
    }
}
