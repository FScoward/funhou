/**
 * Gemini Live 対話結果保存ダイアログ
 * - 保存内容のプレビューと編集
 * - タグ選択
 * - 新規エントリーとして保存
 */

import { useState, useEffect } from 'react'
import { Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Tag } from '@/types'

interface GeminiSaveDialogProps {
  isOpen: boolean
  onClose: () => void
  proposedContent: string
  availableTags: Tag[]
  initialTags?: string[]
  onSave: (content: string, tags: string[]) => Promise<void>
}

export function GeminiSaveDialog({
  isOpen,
  onClose,
  proposedContent,
  availableTags,
  initialTags = [],
  onSave,
}: GeminiSaveDialogProps) {
  const [content, setContent] = useState(proposedContent)
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)
  const [isSaving, setIsSaving] = useState(false)

  // propsが変わったらリセット
  useEffect(() => {
    setContent(proposedContent)
    setSelectedTags(initialTags)
  }, [proposedContent, initialTags])

  const handleSave = async () => {
    if (!content.trim()) return

    setIsSaving(true)
    try {
      await onSave(content, selectedTags)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>対話結果を保存</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* コンテンツ編集エリア */}
          <div>
            <label className="text-sm font-medium mb-2 block">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-40 p-3 rounded-lg border bg-background resize-none text-sm"
              placeholder="保存する内容..."
            />
          </div>

          {/* タグ選択エリア */}
          <div>
            <label className="text-sm font-medium mb-2 block">タグ</label>
            <div className="flex flex-wrap gap-2">
              {/* 選択中のタグ */}
              {selectedTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="default"
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  #{tag}
                  <X size={12} className="ml-1" />
                </Badge>
              ))}
            </div>

            {/* 利用可能なタグ */}
            {availableTags.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-muted-foreground">利用可能なタグ:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {availableTags
                    .filter((tag) => !selectedTags.includes(tag.name))
                    .slice(0, 10)
                    .map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => toggleTag(tag.name)}
                      >
                        #{tag.name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={!content.trim() || isSaving}
          >
            <Save size={16} className="mr-2" />
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
