import { useState } from 'react'
import { Trash2, Pencil, X, FileCode, Type, Archive, Loader2, FileDown } from 'lucide-react'
import CustomInput from '@/components/CustomInput'
import { TagBadge } from '@/components/TagBadge'
import { ClaudeLogImporter } from '@/components/ClaudeLogImporter'
import { truncateText, getFirstLine } from '@/utils/textUtils'
import { Tag } from '@/types'
import MarkdownPreview from '@/components/MarkdownPreview'

interface ReplyCardProps {
  replyId: number
  entryId: number
  content: string
  tags?: Tag[]
  parentEntry?: {
    id: number
    content: string
  }
  archived?: boolean
  parentClaudeSessionId?: string | null
  parentClaudeProjectPath?: string | null
  runningSessionIds?: Set<string>
  isLatestReply?: boolean
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
  onUpdateReplyDirectly: (replyId: number, newContent: string) => void
  onToggleArchive: (replyId: number, entryId: number) => void
  onImportAsReply?: (entryId: number, content: string) => void
  onReplyToParent?: (entryId: number) => void
}

export function ReplyCard({
  replyId,
  entryId,
  content,
  tags,
  parentEntry,
  archived,
  parentClaudeSessionId,
  parentClaudeProjectPath,
  runningSessionIds = new Set(),
  isLatestReply = false,
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
  onUpdateReplyDirectly,
  onToggleArchive,
  onImportAsReply,
  onReplyToParent,
}: ReplyCardProps) {
  const [showMarkdown, setShowMarkdown] = useState(true)

  // 親エントリーが実行中かつ最新の返信かどうか
  const isRunning = parentClaudeSessionId && isLatestReply ? runningSessionIds.has(parentClaudeSessionId) : false

  // アーカイブ済みの場合は折りたたみ表示
  if (archived) {
    return (
      <div className="reply-card archived collapsed">
        <div
          className="archived-preview"
          onClick={() => onToggleArchive(replyId, entryId)}
          title="クリックしてアーカイブを解除"
        >
          <Archive size={14} className="archived-icon" />
          <span className="archived-text">{getFirstLine(content)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`reply-card ${isRunning ? 'running' : ''}`}>
      {isRunning && (
        <div className="running-badge">
          <Loader2 size={12} className="running-spinner" />
          実行中
        </div>
      )}
      <button
        className="archive-button"
        onClick={() => onToggleArchive(replyId, entryId)}
        aria-label="アーカイブ"
      >
        <Archive size={16} />
      </button>
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
      <button
        className="markdown-toggle-button"
        onClick={() => setShowMarkdown(!showMarkdown)}
        aria-label={showMarkdown ? "プレーンテキスト表示" : "Markdown表示"}
      >
        {showMarkdown ? <Type size={16} /> : <FileCode size={16} />}
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
          <div
            className="reply-content-clickable"
            onClick={(e) => {
              // チェックボックスのクリックは編集モードにしない
              if ((e.target as HTMLElement).tagName === 'INPUT') {
                return
              }
              onEdit(replyId, content)
            }}
            title="クリックして編集"
          >
            {showMarkdown ? (
              <MarkdownPreview
                content={content}
                className="reply-text"
                onContentUpdate={(newContent) => onUpdateReplyDirectly(replyId, newContent)}
              />
            ) : (
              <div className="reply-text">{content}</div>
            )}
          </div>
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
          {(onReplyToParent || onImportAsReply) && (
            <div className="reply-actions">
              {onReplyToParent && (
                <button
                  className="reply-to-parent-button"
                  onClick={() => {
                    onScrollToEntry(entryId)
                    onReplyToParent(entryId)
                  }}
                  title="親エントリに返信"
                >
                  💬 返信する
                </button>
              )}
              {onImportAsReply && (
                <ClaudeLogImporter
                  onImport={(logContent) => onImportAsReply(entryId, logContent)}
                  linkedSessionId={parentClaudeSessionId}
                  linkedProjectPath={parentClaudeProjectPath}
                  trigger={
                    <button className="claude-import-button" title="ログを返信として取込">
                      <FileDown size={16} style={{ display: 'inline-block', marginRight: '4px' }} />
                      ログ取込
                    </button>
                  }
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
