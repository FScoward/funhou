import TextareaAutosize from "react-textarea-autosize"
import { ArrowUp, Tag as TagIcon, Plus } from "lucide-react"
import { useState } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TagBadge } from "@/components/TagBadge"

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
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [newTagInput, setNewTagInput] = useState("")

  const showTagSelector = onTagAdd && onTagRemove

  // 選択されていないタグのみを表示
  const unselectedTags = availableTags.filter(
    (tag) => !selectedTags.includes(tag.name)
  )

  const handleAddNewTag = () => {
    const trimmedTag = newTagInput.trim()
    if (trimmedTag && onTagAdd) {
      onTagAdd(trimmedTag)
      setNewTagInput("")
    }
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
        <div className="flex items-center gap-2 flex-wrap px-1">
          {/* タグ追加ボタン */}
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <TagIcon className="size-3 mr-1" />
                タグを追加
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="space-y-2">
                {/* 新規タグ作成 */}
                <div className="flex gap-1">
                  <Input
                    placeholder="新しいタグ名"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddNewTag()
                      }
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleAddNewTag}
                    className="h-8 px-2"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                {/* 既存タグ一覧 */}
                {unselectedTags.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground px-1">既存のタグから選択</div>
                    <div className="flex flex-wrap gap-1">
                      {unselectedTags.map((tag) => (
                        <TagBadge
                          key={tag.id}
                          tag={tag.name}
                          onClick={(tagName) => {
                            onTagAdd(tagName)
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* 選択されたタグの表示 */}
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              variant="selected"
              onRemove={onTagRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
