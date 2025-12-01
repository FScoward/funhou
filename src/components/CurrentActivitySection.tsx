import { useState } from 'react'
import { Sparkles, ArrowUp } from 'lucide-react'
import TextareaAutosize from 'react-textarea-autosize'
import { Entry } from '@/types'
import MarkdownPreview from '@/components/MarkdownPreview'
import { TagBadge } from '@/components/TagBadge'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group'

interface CurrentActivitySectionProps {
  currentActivity: Entry | null
  onSave: (content: string, tags: string[]) => Promise<void>
  onTagClick: (tag: string) => void
  isLoading?: boolean
}

export function CurrentActivitySection({
  currentActivity,
  onSave,
  onTagClick,
  isLoading = false,
}: CurrentActivitySectionProps) {
  const [content, setContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSave(content.trim(), [])
      setContent('')
      setIsEditing(false)
    } catch (error) {
      console.error('今何してる？の保存に失敗しました:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setIsEditing(false)
      setContent('')
    }
  }

  const handleContentClick = () => {
    if (currentActivity) {
      setContent(currentActivity.content)
    }
    setIsEditing(true)
  }

  const hasContent = content.trim().length > 0

  if (isLoading) {
    return (
      <div className="current-activity-section">
        <div className="current-activity-card">
          <div className="current-activity-header">
            <Sparkles size={18} className="current-activity-icon" />
            <span className="current-activity-label">今何してる？</span>
          </div>
          <div className="current-activity-empty">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="current-activity-section">
      <div className="current-activity-card">
        <div className="current-activity-header">
          <Sparkles size={18} className="current-activity-icon" />
          <span className="current-activity-label">今何してる？</span>
        </div>

        {isEditing || !currentActivity ? (
          <div className="current-activity-input">
            <InputGroup>
              <TextareaAutosize
                data-slot="input-group-control"
                className="flex field-sizing-content min-h-10 w-full resize-none bg-transparent px-3 py-2 text-base transition-[color,box-shadow] outline-none md:text-sm border-0 focus-visible:ring-0 dark:bg-transparent"
                placeholder="今やっていることを入力..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                minRows={1}
                autoFocus
              />
              <InputGroupAddon align="block-end">
                <div className="flex items-center justify-end w-full gap-2">
                  {isEditing && currentActivity && (
                    <button
                      type="button"
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setIsEditing(false)
                        setContent('')
                      }}
                      disabled={isSubmitting}
                    >
                      キャンセル
                    </button>
                  )}
                  <InputGroupButton
                    className={`rounded-full transition-opacity ${hasContent ? 'opacity-100' : 'opacity-30'}`}
                    size="icon-xs"
                    variant="default"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <ArrowUp className="size-[14px]" />
                  </InputGroupButton>
                </div>
              </InputGroupAddon>
            </InputGroup>
          </div>
        ) : (
          <div className="current-activity-content" onClick={handleContentClick}>
            <MarkdownPreview content={currentActivity.content} />
            {currentActivity.tags && currentActivity.tags.length > 0 && (
              <div className="current-activity-tags">
                {currentActivity.tags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    tag={tag.name}
                    onClick={onTagClick}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
