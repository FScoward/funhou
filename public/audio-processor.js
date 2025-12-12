/**
 * AudioWorklet Processor for PCM audio conversion
 *
 * 入力: Float32 audio samples (-1.0 to 1.0)
 * 出力: Int16 PCM samples (Little-endian)
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(0)
    // 128サンプルごとに送信（約8ms @ 16kHz）
    this.bufferSize = 4096
  }

  /**
   * Float32からInt16 PCMに変換
   */
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      // クリッピングを防ぐために -1.0 ~ 1.0 の範囲に制限
      const sample = Math.max(-1, Math.min(1, float32Array[i]))
      // Int16の範囲にスケール (-32768 ~ 32767)
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }
    return int16Array
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]

    // 入力がない場合はスキップ
    if (!input || !input[0] || input[0].length === 0) {
      return true
    }

    // モノラルチャンネルを取得
    const channelData = input[0]

    // バッファに追加
    const newBuffer = new Float32Array(this.buffer.length + channelData.length)
    newBuffer.set(this.buffer)
    newBuffer.set(channelData, this.buffer.length)
    this.buffer = newBuffer

    // バッファが閾値に達したら送信
    while (this.buffer.length >= this.bufferSize) {
      // バッファから取り出し
      const chunk = this.buffer.slice(0, this.bufferSize)
      this.buffer = this.buffer.slice(this.bufferSize)

      // PCMに変換してメインスレッドに送信
      const pcmData = this.float32ToInt16(chunk)
      this.port.postMessage(pcmData.buffer, [pcmData.buffer])
    }

    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
