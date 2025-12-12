/**
 * 音声処理ユーティリティ
 * - マイク入力の取得とPCM変換
 * - 音声出力の再生
 */

/**
 * マイク入力プロセッサ
 * - マイクから音声を取得
 * - AudioWorkletでPCM 16bit 16kHzに変換
 * - コールバックで音声データを送信
 */
export class AudioInputProcessor {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private isRunning = false

  /** 音声データを受け取るコールバック */
  onAudioData?: (pcmData: ArrayBuffer) => void

  /**
   * マイク入力を開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('AudioInputProcessor is already running')
      return
    }

    try {
      // マイクアクセスを取得
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // AudioContextを作成（16kHz）
      this.audioContext = new AudioContext({ sampleRate: 16000 })

      // AudioWorkletモジュールを読み込み
      await this.audioContext.audioWorklet.addModule('/audio-processor.js')

      // ソースノードを作成
      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream
      )

      // PCMプロセッサノードを作成
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'pcm-processor'
      )

      // PCMデータを受信
      this.workletNode.port.onmessage = (event) => {
        if (this.onAudioData) {
          this.onAudioData(event.data)
        }
      }

      // ノードを接続
      this.sourceNode.connect(this.workletNode)
      // 出力には接続しない（モニタリングなし）

      this.isRunning = true
      console.log('AudioInputProcessor started')
    } catch (error) {
      console.error('Failed to start AudioInputProcessor:', error)
      this.stop()
      throw error
    }
  }

  /**
   * マイク入力を停止
   */
  stop(): void {
    // ノードの切断
    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    // メディアストリームの停止
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    // AudioContextのクローズ
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.isRunning = false
    console.log('AudioInputProcessor stopped')
  }

  /**
   * 実行中かどうか
   */
  get running(): boolean {
    return this.isRunning
  }
}

/**
 * 音声出力プロセッサ
 * - PCMデータをAudioBufferに変換
 * - スケジューリングベースの連続再生でギャップを防止
 */
export class AudioOutputProcessor {
  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  private nextPlayTime = 0
  private isDisposed = false
  private scheduledSources: AudioBufferSourceNode[] = []

  constructor() {
    // AudioContextは24kHz（Gemini出力形式）
    this.audioContext = new AudioContext({ sampleRate: 24000 })
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.audioContext.destination)
    this.nextPlayTime = this.audioContext.currentTime
  }

  /**
   * PCMデータをAudioBufferに変換
   */
  private pcmToAudioBuffer(pcmData: ArrayBuffer): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext is not initialized')
    }

    // Int16からFloat32に変換
    const int16Array = new Int16Array(pcmData)
    const float32Array = new Float32Array(int16Array.length)

    for (let i = 0; i < int16Array.length; i++) {
      // Int16の範囲を -1.0 ~ 1.0 にスケール（32768で統一）
      float32Array[i] = int16Array[i] / 32768.0
    }

    // AudioBufferを作成
    const audioBuffer = this.audioContext.createBuffer(
      1, // モノラル
      float32Array.length,
      24000 // サンプルレート
    )

    // データをコピー
    audioBuffer.getChannelData(0).set(float32Array)

    return audioBuffer
  }

  /**
   * 音声データを再生キューに追加（スケジューリングベース）
   */
  enqueue(pcmData: ArrayBuffer): void {
    if (!this.audioContext || !this.gainNode || pcmData.byteLength === 0 || this.isDisposed) {
      return
    }

    try {
      const audioBuffer = this.pcmToAudioBuffer(pcmData)

      // AudioBufferSourceNodeを作成
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.gainNode)

      // 現在時刻より前なら現在時刻から開始
      const currentTime = this.audioContext.currentTime
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime
      }

      // スケジュールして再生
      source.start(this.nextPlayTime)
      this.scheduledSources.push(source)

      // 終了時にリストから削除
      source.onended = () => {
        const index = this.scheduledSources.indexOf(source)
        if (index > -1) {
          this.scheduledSources.splice(index, 1)
        }
      }

      // 次の再生時刻を更新
      this.nextPlayTime += audioBuffer.duration
    } catch (error) {
      console.error('Failed to enqueue audio:', error)
    }
  }

  /**
   * 再生を中断（ユーザーが話し始めた時）
   */
  interrupt(): void {
    // スケジュールされた全ての音声を停止
    for (const source of this.scheduledSources) {
      try {
        source.stop()
      } catch {
        // 既に停止している場合は無視
      }
    }
    this.scheduledSources = []

    // 次の再生時刻をリセット
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime
    }

    console.log('Audio playback interrupted')
  }

  /**
   * 音量を設定 (0.0 - 1.0)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  /**
   * 再生中かどうか
   */
  get playing(): boolean {
    return this.scheduledSources.length > 0
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.isDisposed = true
    this.interrupt()

    if (this.gainNode) {
      this.gainNode.disconnect()
      this.gainNode = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

/**
 * マイク権限を確認
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const result = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    })
    return result.state === 'granted'
  } catch {
    // 権限APIがサポートされていない場合は、実際にアクセスを試みる
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch {
      return false
    }
  }
}

/**
 * マイク権限をリクエスト
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch (error) {
    console.error('Microphone permission denied:', error)
    return false
  }
}
