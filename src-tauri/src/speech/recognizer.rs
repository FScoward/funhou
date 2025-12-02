use block2::RcBlock;
use objc2::rc::Retained;
use objc2::AllocAnyThread;
use objc2_avf_audio::{AVAudioEngine, AVAudioPCMBuffer, AVAudioTime};
use objc2_foundation::{NSError, NSLocale, NSString};
use objc2_speech::{
    SFSpeechAudioBufferRecognitionRequest, SFSpeechRecognitionResult, SFSpeechRecognitionTask,
    SFSpeechRecognizer, SFSpeechRecognizerAuthorizationStatus,
};
use std::ptr::NonNull;
use std::sync::{Arc, Mutex};

use crate::speech::config::RecognitionResult;

type ResultCallback = Arc<Mutex<Option<Box<dyn Fn(RecognitionResult) + Send + 'static>>>>;

/// SFSpeechRecognizerのRustラッパー
pub struct SpeechRecognizerWrapper {
    recognizer: Retained<SFSpeechRecognizer>,
    audio_engine: Retained<AVAudioEngine>,
    recognition_request: Mutex<Option<Retained<SFSpeechAudioBufferRecognitionRequest>>>,
    recognition_task: Mutex<Option<Retained<SFSpeechRecognitionTask>>>,
    is_listening: Mutex<bool>,
    result_callback: ResultCallback,
}

// 明示的にSend+Syncを実装（Objective-Cオブジェクトはスレッドセーフ）
unsafe impl Send for SpeechRecognizerWrapper {}
unsafe impl Sync for SpeechRecognizerWrapper {}

impl SpeechRecognizerWrapper {
    /// 新しいSpeechRecognizerWrapperを作成
    pub fn new(locale: &str) -> Result<Self, String> {
        unsafe {
            // ロケールを設定
            let locale_str = NSString::from_str(locale);
            let ns_locale = NSLocale::initWithLocaleIdentifier(NSLocale::alloc(), &locale_str);

            // SFSpeechRecognizerを初期化
            let recognizer =
                SFSpeechRecognizer::initWithLocale(SFSpeechRecognizer::alloc(), &ns_locale)
                    .ok_or("Failed to create SFSpeechRecognizer")?;

            // 利用可能かチェック
            if !recognizer.isAvailable() {
                return Err("Speech recognizer is not available".to_string());
            }

            // AVAudioEngineを初期化
            let audio_engine = AVAudioEngine::new();

            Ok(Self {
                recognizer,
                audio_engine,
                recognition_request: Mutex::new(None),
                recognition_task: Mutex::new(None),
                is_listening: Mutex::new(false),
                result_callback: Arc::new(Mutex::new(None)),
            })
        }
    }

    /// 音声認識の認可をリクエスト
    #[allow(dead_code)]
    pub fn request_authorization<F>(callback: F)
    where
        F: Fn(bool) + Send + 'static,
    {
        let callback = Arc::new(Mutex::new(Some(callback)));
        let callback_clone = callback.clone();

        let block = RcBlock::new(move |status: SFSpeechRecognizerAuthorizationStatus| {
            // SFSpeechRecognizerAuthorizationStatus::Authorized == 3
            let authorized = status == SFSpeechRecognizerAuthorizationStatus::Authorized;
            if let Ok(mut guard) = callback_clone.lock() {
                if let Some(cb) = guard.take() {
                    cb(authorized);
                }
            }
        });

        unsafe {
            SFSpeechRecognizer::requestAuthorization(&block);
        }
    }

    /// 音声認識を開始
    pub fn start_listening<F>(&self, callback: F) -> Result<(), String>
    where
        F: Fn(RecognitionResult) + Send + 'static,
    {
        // 既にリスニング中かチェック
        {
            let is_listening = self.is_listening.lock().map_err(|e| e.to_string())?;
            if *is_listening {
                return Err("Already listening".to_string());
            }
        }

        // コールバックを設定
        {
            let mut cb_guard = self.result_callback.lock().map_err(|e| e.to_string())?;
            *cb_guard = Some(Box::new(callback));
        }

        unsafe {
            // 認識リクエストを作成
            let request = SFSpeechAudioBufferRecognitionRequest::new();
            request.setShouldReportPartialResults(true);

            // オーディオ入力ノードを取得
            let input_node = self.audio_engine.inputNode();
            let record_format = input_node.outputFormatForBus(0);

            // コールバッククロージャを準備
            let result_callback = self.result_callback.clone();
            let result_block = RcBlock::new(
                move |result: *mut SFSpeechRecognitionResult, error: *mut NSError| {
                    if !error.is_null() {
                        let error_ref = &*error;
                        eprintln!("[Speech] Recognition error: {}", error_ref.localizedDescription());
                    }
                    if !result.is_null() {
                        let result_ref = &*result;
                        let transcription = result_ref.bestTranscription();
                        let text = transcription.formattedString().to_string();
                        let is_final = result_ref.isFinal();

                        println!("[Speech] Recognized: '{}' (final: {})", text, is_final);

                        if let Ok(cb_guard) = result_callback.lock() {
                            if let Some(ref cb) = *cb_guard {
                                cb(RecognitionResult { text, is_final });
                            }
                        }
                    } else {
                        println!("[Speech] Result is null");
                    }
                },
            );

            // 認識タスクを開始
            let task = self
                .recognizer
                .recognitionTaskWithRequest_resultHandler(&request, &result_block);

            // オーディオタップを設定
            let request_clone = request.clone();
            let tap_block =
                RcBlock::new(move |buffer: NonNull<AVAudioPCMBuffer>, _when: NonNull<AVAudioTime>| {
                    request_clone.appendAudioPCMBuffer(buffer.as_ref());
                });

            input_node.installTapOnBus_bufferSize_format_block(
                0,
                1024,
                Some(&record_format),
                &*tap_block as *const _ as *mut _,
            );

            // オーディオエンジンを開始
            self.audio_engine.prepare();
            self.audio_engine
                .startAndReturnError()
                .map_err(|e| format!("Failed to start audio engine: {}", e.localizedDescription()))?;

            // 状態を更新
            {
                let mut req_guard = self.recognition_request.lock().map_err(|e| e.to_string())?;
                *req_guard = Some(request);
            }
            {
                let mut task_guard = self.recognition_task.lock().map_err(|e| e.to_string())?;
                *task_guard = Some(task);
            }
            {
                let mut is_listening = self.is_listening.lock().map_err(|e| e.to_string())?;
                *is_listening = true;
            }
        }

        Ok(())
    }

    /// 音声認識を停止
    pub fn stop_listening(&self) -> Result<(), String> {
        {
            let is_listening = self.is_listening.lock().map_err(|e| e.to_string())?;
            if !*is_listening {
                return Ok(());
            }
        }

        unsafe {
            // オーディオエンジンを停止
            self.audio_engine.stop();
            self.audio_engine.inputNode().removeTapOnBus(0);

            // 認識リクエストを終了
            {
                let mut req_guard = self.recognition_request.lock().map_err(|e| e.to_string())?;
                if let Some(ref request) = *req_guard {
                    request.endAudio();
                }
                *req_guard = None;
            }

            // 認識タスクをキャンセル
            {
                let mut task_guard = self.recognition_task.lock().map_err(|e| e.to_string())?;
                if let Some(ref task) = *task_guard {
                    task.cancel();
                }
                *task_guard = None;
            }

            // 状態を更新
            {
                let mut is_listening = self.is_listening.lock().map_err(|e| e.to_string())?;
                *is_listening = false;
            }

            // コールバックをクリア
            {
                let mut cb_guard = self.result_callback.lock().map_err(|e| e.to_string())?;
                *cb_guard = None;
            }
        }

        Ok(())
    }

    /// リスニング中かどうかを返す
    #[allow(dead_code)]
    pub fn is_listening(&self) -> bool {
        self.is_listening
            .lock()
            .map(|guard| *guard)
            .unwrap_or(false)
    }
}
