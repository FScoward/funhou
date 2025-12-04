import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { createPortal } from "react-dom"
import TextareaAutosize from "react-textarea-autosize"
import { ArrowUp, Mic, MicOff, Loader2, ListTodo } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { TagSelector } from "@/components/TagSelector"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useOllamaFormatting } from "@/hooks/useOllamaFormatting"
import { convertSelectionToTasks } from "@/utils/taskConversionUtils"
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
  /** 送信ボタンの横に表示する追加ボタン */
  additionalButtons?: React.ReactNode
  /** 選択行をタスクに変換する右クリックメニューを有効にするか */
  enableTaskConversion?: boolean
}

export interface CustomInputRef {
  toggleMic: () => void
}

const CustomInput = forwardRef<CustomInputRef, CustomInputProps>(function CustomInput({
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
  additionalButtons,
  enableTaskConversion = false,
}, ref) {
  const hasContent = value.trim().length > 0
  const showTagSelector = onTagAdd && onTagRemove

  // このインスタンスがアクティブかどうか
  const [isActive, setIsActive] = useState(false)
  const isActiveRef = useRef<boolean>(false)

  // コンテキストメニューの状態（タスク変換用）
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  // 右クリックハンドラ（タスク変換用）
  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!enableTaskConversion) return

    const textarea = e.currentTarget
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    // テキストが選択されている場合のみメニューを表示
    if (start !== end) {
      e.preventDefault()
      setMenuPosition({ x: e.clientX + 8, y: e.clientY + 8 })
      setSelection({ start, end })
      setMenuOpen(true)
    }
  }

  // タスクに変換
  const handleConvertToTask = () => {
    const result = convertSelectionToTasks(value, selection.start, selection.end)
    onChange(result.text)

    // 変換後の選択範囲を設定
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(result.newSelectionStart, result.newSelectionEnd)
        textareaRef.current.focus()
      }
    })

    setMenuOpen(false)
  }

  // ポーズ検出時に音声認識を停止→整形→再開
  const handlePauseDetected = async (fullText: string) => {
    if (!isActiveRef.current || !ollamaEnabled || isFormattingRef.current) return

    isFormattingRef.current = true

    // 音声認識を一時停止（refを使って呼ぶ）
    await stopRecognitionRef.current()

    // Ollamaで整形
    const formattedText = await formatText(fullText)

    // 整形結果を反映
    lastProgramValueRef.current = formattedText
    onChange(formattedText)

    // 整形後のテキストを新しいベースにする
    baseTextRef.current = formattedText
    currentSpeechTextRef.current = ''

    // マイクがまだアクティブ状態なら音声認識を再開（refを使って呼ぶ）
    if (isActiveRef.current) {
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
    onResult: (text) => {
      if (!isActiveRef.current) {
        return
      }

      // 音声認識結果を保存
      currentSpeechTextRef.current = text

      // ベーステキスト + 音声認識結果
      const fullText = baseTextRef.current + text

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
    // マイクがアクティブな場合のみ、プログラムからの更新を検出してスキップ
    if (isActiveRef.current && newValue === lastProgramValueRef.current) {
      return
    }

    onChange(newValue)

    // マイクがアクティブな場合、キーボード編集があったらベースを更新
    if (isActiveRef.current) {
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
        const formattedText = await formatText(currentText)
        onChange(formattedText)
      }
    }
  }

  // 外部からマイクトグルを呼び出せるようにする
  useImperativeHandle(ref, () => ({
    toggleMic: () => {
      if (!isAvailable || isFormatting) return
      toggleRecognition()
    }
  }), [isAvailable, isFormatting, toggleRecognition])

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
          ref={textareaRef}
          data-slot="input-group-control"
          className="flex field-sizing-content min-h-16 w-full resize-none bg-transparent px-3 py-2.5 text-base transition-[color,box-shadow] outline-none md:text-sm border-0 focus-visible:ring-0 dark:bg-transparent"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            // Cmd+D (Mac) または Ctrl+D (Windows/Linux) でマイクトグル
            if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
              e.preventDefault()
              if (isAvailable && !isFormatting) {
                toggleRecognition()
              }
              return
            }
            onKeyDown?.(e)
          }}
          onBlur={onBlur}
          onContextMenu={handleContextMenu}
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
                ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white shadow-lg shadow-red-500/30'
                : 'bg-primary/10 hover:bg-primary/20 text-primary'
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
          {/* 追加ボタン（セッション続行など） */}
          <div className="ml-auto flex items-center gap-1">
            {additionalButtons}
            {/* 送信ボタン */}
            <InputGroupButton
              className={`rounded-full transition-opacity ${hasContent ? 'opacity-100' : 'opacity-30'}`}
              size="icon-xs"
              variant="default"
              onClick={handleSubmit}
            >
              <ArrowUp className="size-[14px]" />
            </InputGroupButton>
          </div>
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

      {/* タスク変換用コンテキストメニュー */}
      {menuOpen && enableTaskConversion && createPortal(
        <div
          ref={menuRef}
          className="textarea-context-menu"
          style={{
            position: 'fixed',
            left: menuPosition.x,
            top: menuPosition.y,
          }}
        >
          <button
            className="textarea-context-menu-option"
            onClick={handleConvertToTask}
          >
            <ListTodo size={14} />
            <span>タスクに変換</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
})

export default CustomInput
