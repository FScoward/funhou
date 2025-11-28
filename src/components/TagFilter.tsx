import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { TagBadge } from '@/components/TagBadge'
import { Tag as TagIcon, Plus, Trash2 } from 'lucide-react'
import type { Tag } from '@/types'

interface TagFilterProps {
  availableTags: Tag[]
  selectedTags: string[]
  filterMode: 'AND' | 'OR'
  onTagSelect: (tag: string) => void
  onTagRemove: (tag: string) => void
  onFilterModeChange: (mode: 'AND' | 'OR') => void
  onClearAll: () => void
  onTagDelete?: (tag: string) => void
  frequentTags?: Tag[]
  recentTags?: Tag[]
}

export function TagFilter({
  availableTags,
  selectedTags,
  filterMode,
  onTagSelect,
  onTagRemove,
  onFilterModeChange,
  onClearAll,
  onTagDelete,
  frequentTags = [],
  recentTags = [],
}: TagFilterProps) {
  const [open, setOpen] = React.useState(false)
  const [newTagInput, setNewTagInput] = React.useState("")
  const [managementMode, setManagementMode] = React.useState(false)

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
      onTagSelect(trimmedTag)
      setNewTagInput("")
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* タグ選択ボタン */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <TagIcon className="size-4" />
            タグでフィルタ
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

            {/* 管理モード切り替え */}
            {onTagDelete && availableTags.length > 0 && (
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-xs text-muted-foreground">
                  {managementMode ? 'タグを削除' : 'タグを選択'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setManagementMode(!managementMode)}
                  className="h-6 text-xs"
                >
                  {managementMode ? '選択モード' : '管理モード'}
                </Button>
              </div>
            )}

            {/* よく使うタグ */}
            {!managementMode && unselectedFrequentTags.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-1">よく使うタグ</div>
                <div className="flex flex-wrap gap-1">
                  {unselectedFrequentTags.map((tag) => (
                    <TagBadge
                      key={tag.id}
                      tag={tag.name}
                      onClick={(tagName) => {
                        onTagSelect(tagName)
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* 最近使ったタグ */}
            {!managementMode && unselectedRecentTags.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-1">最近使ったタグ</div>
                <div className="flex flex-wrap gap-1">
                  {unselectedRecentTags.map((tag) => (
                    <TagBadge
                      key={tag.id}
                      tag={tag.name}
                      onClick={(tagName) => {
                        onTagSelect(tagName)
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* その他のタグ */}
            {!managementMode && otherTags.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-1">その他のタグ</div>
                <div className="flex flex-wrap gap-1">
                  {otherTags.map((tag) => (
                    <TagBadge
                      key={tag.id}
                      tag={tag.name}
                      onClick={(tagName) => {
                        onTagSelect(tagName)
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* タグ管理（削除） */}
            {managementMode && availableTags.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-1">削除するタグをクリック</div>
                <div className="flex flex-wrap gap-1">
                  {availableTags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5">
                      <TagIcon className="size-3 text-yellow-500" />
                      <span className="text-xs text-gray-600">{tag.name}</span>
                      <button
                        onClick={() => {
                          if (onTagDelete) {
                            onTagDelete(tag.name)
                          }
                        }}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* 選択されたタグの表示 */}
      {selectedTags.length > 0 && (
        <>
          {/* AND/OR切り替えボタン */}
          {selectedTags.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onFilterModeChange(filterMode === 'AND' ? 'OR' : 'AND')
              }
            >
              {filterMode}
            </Button>
          )}

          {/* 選択されたタグバッジ */}
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              variant="selected"
              onClick={onTagSelect}
              onRemove={onTagRemove}
            />
          ))}

          {/* すべてクリアボタン */}
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            クリア
          </Button>
        </>
      )}
    </div>
  )
}
