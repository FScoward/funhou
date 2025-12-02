import { useRef } from "react"
import TextareaAutosize from "react-textarea-autosize"
import { ArrowUp, Mic, MicOff } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { TagSelector } from "@/components/TagSelector"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
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
  recentTags = []
}: CustomInputProps) {
  const hasContent = value.trim().length > 0
  const showTagSelector = onTagAdd && onTagRemove

  // 音声認識開始時のテキストを保持
  const textBeforeSpeechRef = useRef<string>('')

  // 音声認識フック
  const { isListening, isAvailable, toggleRecognition: originalToggle } = useSpeechRecognition({
    onResult: (text) => {
      // 音声認識開始前のテキスト + 認識結果を結合
      const prefix = textBeforeSpeechRef.current
      const newValue = prefix ? `${prefix} ${text}` : text
      onChange(newValue)
    },
    onError: (error) => {
      console.error('Speech recognition error:', error)
    },
  })

  // トグル時に現在のテキストを保存
  const toggleRecognition = async () => {
    if (!isListening) {
      // 開始時に現在のテキストを保存
      textBeforeSpeechRef.current = value.trim()
    }
    await originalToggle()
  }

  return (
    <div className="w-full space-y-2">
      <InputGroup>
        <TextareaAutosize
          data-slot="input-group-control"
          className="flex field-sizing-content min-h-16 w-full resize-none bg-transparent px-3 py-2.5 text-base transition-[color,box-shadow] outline-none md:text-sm border-0 focus-visible:ring-0 dark:bg-transparent"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          minRows={1}
        />
        <InputGroupAddon align="block-end">
          {/* マイクボタン */}
          <InputGroupButton
            className={`rounded-full transition-all ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white'
                : 'opacity-60 hover:opacity-100'
            }`}
            size="icon-xs"
            variant={isListening ? 'destructive' : 'ghost'}
            onClick={toggleRecognition}
            disabled={!isAvailable}
            title={isListening ? '音声入力を停止' : '音声入力を開始'}
          >
            {isListening ? (
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
            onClick={onSubmit}
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
