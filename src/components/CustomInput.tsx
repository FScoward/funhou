import { useRef, useState } from "react"
import TextareaAutosize from "react-textarea-autosize"
import { ArrowUp, Mic, MicOff, Loader2 } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { TagSelector } from "@/components/TagSelector"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useOllamaFormatting } from "@/hooks/useOllamaFormatting"
import type { Tag } from "@/types"

interface CustomInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onBlur?: () => void
  placeholder?: string
  availableTags?: Tag[]
  selectedTags?: string[]
  onTagAdd?: (tag: string) => void
  onTagRemove?: (tag: string) => void
  frequentTags?: Tag[]
  recentTags?: Tag[]
  /** Ollama整形機能が有効かどうか */
  ollamaEnabled?: boolean
  /** 使用するOllamaモデル */
  ollamaModel?: string
}

export default function CustomInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  onBlur,
  placeholder = "今やっていることを記録してください...",
  availableTags = [],
  selectedTags = [],
  onTagAdd,
  onTagRemove,
  frequentTags = [],
  recentTags = [],
  ollamaEnabled = false,
  ollamaModel = 'gemma3:4b',
}: CustomInputProps) {
  const hasContent = value.trim().length > 0
  const showTagSelector = onTagAdd && onTagRemove

  // このインスタンスがアクティブかどうか
  const [isActive, setIsActive] = useState(false)
  const isActiveRef = useRef<boolean>(false)

  // マイクON時点でのテキスト（この後ろに音声認識結果を追加）
  const baseTextRef = useRef<string>('')

  // 現在の音声認識セッションの結果
  const currentSpeechTextRef = useRef<string>('')

  // 最後にプログラムで設定した値（キーボード編集検出用）
  const lastProgramValueRef = useRef<string>('')

  // デバウンスタイマー
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 整形中フラグ（音声認識の再開制御用）
  const isFormattingRef = useRef<boolean>(false)

  // 音声認識の開始/停止関数をrefで保持（順序依存を解決）
  const startRecognitionRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const stopRecognitionRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Ollama整形フック
  const { formatText, isFormatting } = useOllamaFormatting({
    enabled: ollamaEnabled,
    model: ollamaModel,
    onError: (error) => {
      console.error('Ollama formatting error:', error)
    },
  })

  // ポーズ検出時に音声認識を停止→整形→再開
  const handlePauseDetected = async (fullText: string) => {
    if (!isActiveRef.current || !ollamaEnabled || isFormattingRef.current) return

    console.log('[CustomInput] ポーズ検出 → 音声認識停止 → Ollama整形開始:', fullText)
    isFormattingRef.current = true

    // 音声認識を一時停止（refを使って呼ぶ）
    await stopRecognitionRef.current()

    // Ollamaで整形
    const formattedText = await formatText(fullText)
    console.log('[CustomInput] Ollama整形結果:', formattedText)

    // 整形結果を反映
    lastProgramValueRef.current = formattedText
    onChange(formattedText)

    // 整形後のテキストを新しいベースにする
    baseTextRef.current = formattedText
    currentSpeechTextRef.current = ''

    // マイクがまだアクティブ状態なら音声認識を再開（refを使って呼ぶ）
    if (isActiveRef.current) {
      console.log('[CustomInput] 音声認識を再開')
      await startRecognitionRef.current()
    }

    isFormattingRef.current = false
  }

  // デバウンス付きでポーズ検出
  const scheduleFormatting = (fullText: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      handlePauseDetected(fullText)
    }, 1500)
  }

  // 音声認識フック
  const { isAvailable, startRecognition, stopRecognition, toggleRecognition: originalToggle } = useSpeechRecognition({
    onResult: (text, isFinal) => {
      console.log('[CustomInput] 音声認識結果:', { text, isFinal, isActive: isActiveRef.current })

      if (!isActiveRef.current) {
        console.log('[CustomInput] スキップ: このインスタンスは非アクティブ')
        return
      }

      // 音声認識結果を保存
      currentSpeechTextRef.current = text

      // ベーステキスト + 音声認識結果
      const fullText = baseTextRef.current + text
      console.log('[CustomInput] fullText:', fullText, '(base:', baseTextRef.current, '+ speech:', text, ')')

      lastProgramValueRef.current = fullText
      onChange(fullText)

      // Ollamaが有効なら、ポーズ検出後に整形をスケジュール
      if (ollamaEnabled && !isFormattingRef.current) {
        scheduleFormatting(fullText)
      }
    },
    onError: (error) => {
      console.error('Speech recognition error:', error)
    },
  })

  // refに関数を設定
  startRecognitionRef.current = startRecognition
  stopRecognitionRef.current = stopRecognition

  // キーボード編集を検出
  const handleChange = (newValue: string) => {
    // プログラムからの更新の場合は何もしない
    if (newValue === lastProgramValueRef.current) {
      return
    }

    onChange(newValue)

    // マイクがアクティブな場合、キーボード編集があったらベースを更新
    if (isActiveRef.current) {
      console.log('[CustomInput] キーボード編集検出 → ベーステキストを更新:', newValue)
      baseTextRef.current = newValue
      currentSpeechTextRef.current = ''
      lastProgramValueRef.current = newValue

      // 整形タイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }

  // マイクのトグル
  const toggleRecognition = async () => {
    if (!isActive) {
      // 開始時
      baseTextRef.current = value
      currentSpeechTextRef.current = ''
      lastProgramValueRef.current = value
      isActiveRef.current = true
      setIsActive(true)
      console.log('[CustomInput] マイクON, ベーステキスト:', value)
      await originalToggle()
    } else {
      // 停止時
      // 整形タイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      isActiveRef.current = false
      setIsActive(false)
      await originalToggle()

      // 停止時にOllamaで整形
      const currentText = value.trim()
      if (ollamaEnabled && currentText) {
        console.log('[CustomInput] マイク停止 → Ollama整形開始')
        const formattedText = await formatText(currentText)
        console.log('[CustomInput] Ollama整形結果:', formattedText)
        onChange(formattedText)
      }
    }
  }

  // 送信時にマイクをオフにする
  const handleSubmit = async () => {
    if (isActive) {
      // 整形タイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      isActiveRef.current = false
      setIsActive(false)
      await originalToggle()
    }
    onSubmit()
  }

  return (
    <div className="w-full space-y-2">
      <InputGroup>
        <TextareaAutosize
          data-slot="input-group-control"
          className="flex field-sizing-content min-h-16 w-full resize-none bg-transparent px-3 py-2.5 text-base transition-[color,box-shadow] outline-none md:text-sm border-0 focus-visible:ring-0 dark:bg-transparent"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          minRows={1}
        />
        <InputGroupAddon align="block-end">
          {/* 整形中インジケーター */}
          {isFormatting && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
              <Loader2 className="size-3 animate-spin" />
              <span>整形中...</span>
            </div>
          )}
          {/* マイクボタン */}
          <InputGroupButton
            className={`rounded-full transition-all ${
              isActive
                ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white'
                : 'opacity-60 hover:opacity-100'
            }`}
            size="icon-xs"
            variant={isActive ? 'destructive' : 'ghost'}
            onClick={toggleRecognition}
            disabled={!isAvailable || isFormatting}
            title={isActive ? '音声入力を停止' : '音声入力を開始'}
          >
            {isActive ? (
              <MicOff className="size-[14px]" />
            ) : (
              <Mic className="size-[14px]" />
            )}
          </InputGroupButton>
          {/* 送信ボタン */}
          <InputGroupButton
            className={`ml-auto rounded-full transition-opacity ${hasContent ? 'opacity-100' : 'opacity-30'}`}
            size="icon-xs"
            variant="default"
            onClick={handleSubmit}
          >
            <ArrowUp className="size-[14px]" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* タグ選択エリア */}
      {showTagSelector && (
        <div className="px-1">
          <TagSelector
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagAdd={onTagAdd}
            onTagRemove={onTagRemove}
            frequentTags={frequentTags}
            recentTags={recentTags}
          />
        </div>
      )}
    </div>
  )
}
