import { useState, useCallback, useRef } from 'react'
import { formatTextWithOllama, checkOllamaAvailable } from '@/lib/ollama'

export interface UseOllamaFormattingProps {
  /** Ollama整形機能が有効かどうか */
  enabled: boolean
  /** 使用するモデル名 */
  model?: string
  /** 整形完了時のコールバック */
  onFormatted?: (formattedText: string) => void
  /** エラー発生時のコールバック */
  onError?: (error: Error) => void
}

export interface UseOllamaFormattingReturn {
  /** テキストを整形する */
  formatText: (text: string) => Promise<string>
  /** 整形処理中かどうか */
  isFormatting: boolean
  /** Ollamaサーバーが利用可能かどうか */
  isAvailable: boolean | null
  /** 最後のエラー */
  lastError: Error | null
  /** Ollamaサーバーの可用性をチェック */
  checkAvailability: () => Promise<boolean>
}

export function useOllamaFormatting({
  enabled,
  model = 'gemma3:4b',
  onFormatted,
  onError,
}: UseOllamaFormattingProps): UseOllamaFormattingReturn {
  const [isFormatting, setIsFormatting] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)

  // コールバックをrefで保持して最新の値を参照できるようにする
  const onFormattedRef = useRef(onFormatted)
  const onErrorRef = useRef(onError)

  onFormattedRef.current = onFormatted
  onErrorRef.current = onError

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    const available = await checkOllamaAvailable()
    setIsAvailable(available)
    return available
  }, [])

  const formatText = useCallback(
    async (text: string): Promise<string> => {
      console.log('[useOllamaFormatting] formatText called')
      console.log('[useOllamaFormatting] enabled:', enabled)
      console.log('[useOllamaFormatting] text:', text)

      // 機能が無効、またはテキストが空の場合はそのまま返す
      if (!enabled || !text.trim()) {
        console.log('[useOllamaFormatting] スキップ: enabled=', enabled, ', text.trim()=', text.trim())
        return text
      }

      setIsFormatting(true)
      setLastError(null)

      try {
        // 可用性チェック
        console.log('[useOllamaFormatting] Ollama可用性チェック中...')
        const available = await checkOllamaAvailable()
        setIsAvailable(available)
        console.log('[useOllamaFormatting] Ollama available:', available)

        if (!available) {
          const error = new Error('Ollamaサーバーが起動していません')
          setLastError(error)
          onErrorRef.current?.(error)
          return text
        }

        // テキスト整形
        console.log('[useOllamaFormatting] テキスト整形開始...')
        const formattedText = await formatTextWithOllama(text, model)
        console.log('[useOllamaFormatting] 整形完了:', formattedText)
        onFormattedRef.current?.(formattedText)
        return formattedText
      } catch (error) {
        console.error('[useOllamaFormatting] エラー:', error)
        const err = error instanceof Error ? error : new Error(String(error))
        setLastError(err)
        onErrorRef.current?.(err)
        return text
      } finally {
        setIsFormatting(false)
      }
    },
    [enabled, model]
  )

  return {
    formatText,
    isFormatting,
    isAvailable,
    lastError,
    checkAvailability,
  }
}
