import TextareaAutosize from "react-textarea-autosize"
import { ArrowUp } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"

interface CustomInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
}

export default function CustomInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  placeholder = "今やっていることを記録してください..."
}: CustomInputProps) {
  const hasContent = value.trim().length > 0

  return (
    <div className="w-full">
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
            size="icon-sm"
            variant="default"
            onClick={onSubmit}
          >
            <ArrowUp size={16} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
