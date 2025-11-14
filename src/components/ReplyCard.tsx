import { Trash2, Pencil, X } from 'lucide-react'
import CustomInput from '@/components/CustomInput'
import { TagBadge } from '@/components/TagBadge'
import { truncateText } from '@/utils/textUtils'
import { Tag } from '@/types'

interface ReplyCardProps {
  replyId: number
  entryId: number
  content: string
  tags?: Tag[]
  parentEntry?: {
    id: number
    content: string
  }
  isEditing: boolean
  editContent: string
  editManualTags: string[]
  availableTags: Tag[]
  selectedTags: string[]
  onEdit: (replyId: number, content: string) => void
  onCancelEdit: () => void
  onUpdateReply: (replyId: number, entryId: number) => void
  onDelete: (replyId: number, entryId: number) => void
  onEditContentChange: (content: string) => void
  onEditTagAdd: (tag: string) => void
  onEditTagRemove: (tag: string) => void
  onTagClick: (tag: string) => void
  onScrollToEntry: (entryId: number) => void
}

export function ReplyCard({
  replyId,
  entryId,
  content,
  tags,
  parentEntry,
  isEditing,
  editContent,
  editManualTags,
  availableTags,
  selectedTags,
  onEdit,
  onCancelEdit,
  onUpdateReply,
  onDelete,
  onEditContentChange,
  onEditTagAdd,
  onEditTagRemove,
  onTagClick,
  onScrollToEntry,
}: ReplyCardProps) {
  return (
    <div className="reply-card">
      <button
        className="edit-button"
        onClick={() => isEditing ? onCancelEdit() : onEdit(replyId, content)}
        aria-label={isEditing ? "キャンセル" : "編集"}
      >
        {isEditing ? <X size={16} /> : <Pencil size={16} />}
      </button>
      <button
        className="delete-button"
        onClick={() => onDelete(replyId, entryId)}
        aria-label="削除"
      >
        <Trash2 size={16} />
      </button>
      {parentEntry && (
        <button
          className="reply-reference"
          onClick={() => onScrollToEntry(parentEntry.id)}
        >
          → 「{truncateText(parentEntry.content)}」への返信
        </button>
      )}
      {isEditing ? (
        <div className="edit-input-section">
          <CustomInput
            value={editContent}
            onChange={onEditContentChange}
            onSubmit={() => onUpdateReply(replyId, entryId)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                onUpdateReply(replyId, entryId)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancelEdit()
              }
            }}
            placeholder="返信を編集..."
            availableTags={availableTags}
            selectedTags={editManualTags}
            onTagAdd={onEditTagAdd}
            onTagRemove={onEditTagRemove}
          />
        </div>
      ) : (
        <>
          <div className="reply-text">{content}</div>
          {tags && tags.length > 0 && (
            <div className="entry-tags">
              {tags.map(tag => (
                <TagBadge
                  key={tag.id}
                  tag={tag.name}
                  variant={selectedTags.includes(tag.name) ? 'selected' : 'default'}
                  onClick={onTagClick}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
