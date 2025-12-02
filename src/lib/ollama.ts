/**
 * Ollama API サービス
 * ローカルのOllamaサーバーと通信してテキスト整形を行う
 */

const OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'gemma3:4b'

export interface OllamaGenerateRequest {
  model: string
  prompt: string
  stream?: boolean
}

export interface OllamaGenerateResponse {
  model: string
  response: string
  done: boolean
}

/**
 * Ollamaサーバーが起動しているかチェック
 */
export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * 利用可能なモデル一覧を取得
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return []
    const data = await response.json()
    return data.models?.map((m: { name: string }) => m.name) ?? []
  } catch {
    return []
  }
}

/**
 * 音声認識テキストを整形するプロンプトを生成
 */
function createFormattingPrompt(text: string): string {
  return `音声認識テキストに句読点を追加してください。

ルール:
- 句読点（、。？！）を適切な位置に追加する
- 改行は入れない（1行で出力）
- 整形後のテキストのみを出力（説明不要）
- 元の意味を変えない

入力: ${text}
出力:`
}

/**
 * Ollama APIを使ってテキストを整形
 */
export async function formatTextWithOllama(
  text: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const prompt = createFormattingPrompt(text)

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    } as OllamaGenerateRequest),
    signal: AbortSignal.timeout(30000), // 30秒タイムアウト
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
  }

  const data: OllamaGenerateResponse = await response.json()
  return data.response.trim()
}

/**
 * テキスト整形を試行し、失敗時は元のテキストを返す
 */
export async function tryFormatText(
  text: string,
  model: string = DEFAULT_MODEL,
  onError?: (error: Error) => void
): Promise<string> {
  if (!text.trim()) return text

  try {
    const isAvailable = await checkOllamaAvailable()
    if (!isAvailable) {
      onError?.(new Error('Ollama server is not running'))
      return text
    }

    return await formatTextWithOllama(text, model)
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
    return text
  }
}
