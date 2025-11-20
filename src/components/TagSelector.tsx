import { useState } from "react"
import { Plus, Tag as TagIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TagBadge } from "@/components/TagBadge"
import { Tag } from "@/types"

interface TagSelectorProps {
  availableTags: Tag[]
  selectedTags: string[]
  onTagAdd: (tag: string) => void
  onTagRemove?: (tag: string) => void
  trigger?: React.ReactNode
}

export function TagSelector({
  availableTags,
  selectedTags,
  onTagAdd,
  onTagRemove,
  trigger
}: TagSelectorProps) {
  const [open, setOpen] = useState(false)
  const [newTagInput, setNewTagInput] = useState("")

  // 選択されていないタグのみを表示
  const unselectedTags = availableTags.filter(
    (tag) => !selectedTags.includes(tag.name)
  )

  const handleAddNewTag = () => {
    const trimmedTag = newTagInput.trim()
    if (trimmedTag) {
      onTagAdd(trimmedTag)
      setNewTagInput("")
      // 連続して追加できるように閉じない
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <TagIcon className="size-3 mr-1" />
              タグを追加
            </Button>
          )}
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

      {/* 選択されたタグの表示 (onTagRemoveが渡された場合のみ表示) */}
      {onTagRemove && selectedTags.map((tag) => (
        <TagBadge
          key={tag}
          tag={tag}
          variant="selected"
          onRemove={onTagRemove}
        />
      ))}
    </div>
  )
}
