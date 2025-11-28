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
  frequentTags?: Tag[]
  recentTags?: Tag[]
}

export function TagSelector({
  availableTags,
  selectedTags,
  onTagAdd,
  onTagRemove,
  trigger,
  frequentTags = [],
  recentTags = []
}: TagSelectorProps) {
  const [open, setOpen] = useState(false)
  const [newTagInput, setNewTagInput] = useState("")

  // 選択されていないタグのみを表示
  const unselectedTags = availableTags.filter(
    (tag) => !selectedTags.includes(tag.name)
  )

  // よく使うタグ（選択されていないもののみ）
  const unselectedFrequentTags = frequentTags.filter(
    (tag) => !selectedTags.includes(tag.name)
  )

  // 最近使ったタグ（選択されていないもののみ）
  const unselectedRecentTags = recentTags.filter(
    (tag) => !selectedTags.includes(tag.name)
  )

  // frequentとrecentに含まれないタグ
  const frequentIds = new Set(frequentTags.map(t => t.id))
  const recentIds = new Set(recentTags.map(t => t.id))
  const otherTags = unselectedTags.filter(
    (tag) => !frequentIds.has(tag.id) && !recentIds.has(tag.id)
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

            {/* よく使うタグ */}
            {unselectedFrequentTags.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-1">よく使うタグ</div>
                <div className="flex flex-wrap gap-1">
                  {unselectedFrequentTags.map((tag) => (
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

            {/* 最近使ったタグ */}
            {unselectedRecentTags.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-1">最近使ったタグ</div>
                <div className="flex flex-wrap gap-1">
                  {unselectedRecentTags.map((tag) => (
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

            {/* その他のタグ */}
            {otherTags.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-1">その他のタグ</div>
                <div className="flex flex-wrap gap-1">
                  {otherTags.map((tag) => (
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
