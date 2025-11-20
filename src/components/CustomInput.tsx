import TextareaAutosize from "react-textarea-autosize"
import { ArrowUp } from "lucide-react"


import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { TagSelector } from "@/components/TagSelector"

interface Tag {
  id: number
  name: string
}

interface CustomInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  availableTags?: Tag[]
  selectedTags?: string[]
  onTagAdd?: (tag: string) => void
  onTagRemove?: (tag: string) => void
}

export default function CustomInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  placeholder = "今やっていることを記録してください...",
  availableTags = [],
  selectedTags = [],
  onTagAdd,
  onTagRemove
}: CustomInputProps) {
  const hasContent = value.trim().length > 0
  const showTagSelector = onTagAdd && onTagRemove



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
          minRows={1}
        />
        <InputGroupAddon align="block-end">
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
          />
        </div>
      )}
    </div>
  )
}
