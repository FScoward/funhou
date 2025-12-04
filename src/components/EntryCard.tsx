import { useState } from 'react'
import { Trash2, X, Pin, FileCode, Type, Archive, Terminal, FileDown, Link } from 'lucide-react'
import CustomInput from '@/components/CustomInput'
import { TagBadge } from '@/components/TagBadge'
import { TagSelector } from '@/components/TagSelector'
import { ClaudeLaunchDialog } from '@/components/ClaudeLaunchDialog'
import { ClaudeLogImporter } from '@/components/ClaudeLogImporter'
import { ClaudeSessionLinkDialog } from '@/components/ClaudeSessionLinkDialog'
import { resumeClaudeCode } from '@/lib/claudeLogs'
import { formatTimestamp } from '@/utils/dateUtils'
import { getFirstLine } from '@/utils/textUtils'
import { Reply, Tag } from '@/types'
import MarkdownPreview from '@/components/MarkdownPreview'

interface EntryCardProps {
  id: number
  content: string
  tags?: Tag[]
  replyCount?: number
  replies?: Reply[]
  pinned?: boolean
  archived?: boolean
  claudeSessionId?: string | null
  claudeCwd?: string | null
  claudeProjectPath?: string | null
  isEditing: boolean
  editContent: string
  editManualTags: string[]
  availableTags: Tag[]
  selectedTags: string[]
  replyingToId: number | null
  replyContent: string
  replyManualTags: string[]
  expandedReplies: boolean
  frequentTags?: Tag[]
  recentTags?: Tag[]
  onEdit: (id: number, content: string) => void
  onCancelEdit: () => void
  onUpdateEntry: (id: number) => void
  onDelete: (id: number) => void
  onEditContentChange: (content: string) => void
  onEditTagAdd: (tag: string) => void
  onEditTagRemove: (tag: string) => void
  onTagClick: (tag: string) => void
  onReplyToggle: (id: number) => void
  onReplyContentChange: (content: string) => void
  onReplyTagAdd: (tag: string) => void
  onReplyTagRemove: (tag: string) => void
  onAddReply: (id: number) => void
  onToggleReplies: (id: number) => void
  onTogglePin: (id: number) => void
  onToggleArchive: (id: number) => void
  onUpdateEntryDirectly: (entryId: number, newContent: string) => void
  onDirectTagAdd: (tag: string) => void
  onDirectTagRemove: (tag: string) => void
  onImportAsReply?: (entryId: number, content: string) => void
  onLinkClaudeSession?: (entryId: number, sessionId: string, cwd: string, projectPath: string) => void
}

export function EntryCard({
  id,
  content,
  tags,
  replyCount,
  replies,
  pinned,
  archived,
  claudeSessionId,
  claudeCwd,
  claudeProjectPath,
  isEditing,
  editContent,
  editManualTags,
  availableTags,
  selectedTags,
  replyingToId,
  replyContent,
  replyManualTags,
  expandedReplies,
  frequentTags = [],
  recentTags = [],
  onEdit,
  onCancelEdit,
  onUpdateEntry,
  onDelete,
  onEditContentChange,
  onEditTagAdd,
  onEditTagRemove,
  onTagClick,
  onReplyToggle,
  onReplyContentChange,
  onReplyTagAdd,
  onReplyTagRemove,
  onAddReply,
  onToggleReplies,
  onTogglePin,
  onToggleArchive,
  onUpdateEntryDirectly,
  onDirectTagAdd,
  onDirectTagRemove,
  onImportAsReply,
  onLinkClaudeSession,
}: EntryCardProps) {
  const [showMarkdown, setShowMarkdown] = useState(true)

  // アーカイブ済みで折りたたまれた表示
  if (archived) {
    return (
      <div className="entry-card archived collapsed">
        <div
          className="archived-preview"
          onClick={() => onToggleArchive(id)}
          title="クリックしてアーカイブを解除"
        >
          <Archive size={14} className="archived-icon" />
          <span className="archived-text">{getFirstLine(content)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`entry-card ${pinned ? 'pinned' : ''}`}>
      <button
        className="delete-button"
        onClick={() => onDelete(id)}
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
      <button
        className={`pin-button ${pinned ? 'pinned' : ''}`}
        onClick={() => onTogglePin(id)}
        aria-label={pinned ? "ピン留めを解除" : "ピン留め"}
      >
        <Pin size={16} />
      </button>
      <button
        className="archive-button"
        onClick={() => onToggleArchive(id)}
        aria-label="アーカイブ"
      >
        <Archive size={16} />
      </button>
      {isEditing ? (
        <div className="edit-input-section">
          <CustomInput
            value={editContent}
            onChange={onEditContentChange}
            onSubmit={() => onUpdateEntry(id)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                onUpdateEntry(id)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancelEdit()
              }
            }}
            onBlur={onCancelEdit}
            placeholder="エントリーを編集..."
            availableTags={availableTags}
            selectedTags={editManualTags}
            onTagAdd={onEditTagAdd}
            onTagRemove={onEditTagRemove}
            frequentTags={frequentTags}
            recentTags={recentTags}
          />
        </div>
      ) : (
        <>
          <div
            className="entry-content-clickable"
            onClick={(e) => {
              // チェックボックスのクリックは編集モードにしない
              if ((e.target as HTMLElement).tagName === 'INPUT') {
                return
              }
              onEdit(id, content)
            }}
            title="クリックして編集"
          >
            {showMarkdown ? (
              <MarkdownPreview
                content={content}
                className="entry-text"
                onContentUpdate={(newContent) => onUpdateEntryDirectly(id, newContent)}
              />
            ) : (
              <div className="entry-text">{content}</div>
            )}
          </div>
          {tags && tags.length > 0 && (
            <div className="entry-tags flex items-center gap-2 flex-wrap">
              {tags.map(tag => (
                <TagBadge
                  key={tag.id}
                  tag={tag.name}
                  variant={selectedTags.includes(tag.name) ? 'selected' : 'default'}
                  onClick={onTagClick}
                  onRemove={onDirectTagRemove}
                />
              ))}
              <TagSelector
                availableTags={availableTags}
                selectedTags={tags.map(t => t.name)}
                onTagAdd={onDirectTagAdd}
                frequentTags={frequentTags}
                recentTags={recentTags}
              />
            </div>
          )}
          {(!tags || tags.length === 0) && (
            <div className="entry-tags flex items-center gap-2 flex-wrap">
              <TagSelector
                availableTags={availableTags}
                selectedTags={[]}
                onTagAdd={onDirectTagAdd}
                frequentTags={frequentTags}
                recentTags={recentTags}
              />
            </div>
          )}
        </>
      )}

      <div className="entry-actions">
        <button
          className="reply-button"
          onClick={() => onReplyToggle(id)}
        >
          {replyingToId === id ? (
            <>
              <X size={16} style={{ display: 'inline-block', marginRight: '4px' }} /> キャンセル
            </>
          ) : (
            <>
              💬 返信する{(replyCount ?? 0) > 0 && <span className="reply-count"> ({replyCount})</span>}
            </>
          )}
        </button>
        {(replyCount ?? 0) > 0 && (
          <button
            className="show-replies-button"
            onClick={() => onToggleReplies(id)}
          >
            {expandedReplies ? '▼' : '▶'} 返信を表示
          </button>
        )}
        <ClaudeLaunchDialog
          initialPrompt={content}
          trigger={
            <button className="claude-launch-button" title="Claude Codeで実行">
              <Terminal size={16} style={{ display: 'inline-block', marginRight: '4px' }} />
              Claude Code
            </button>
          }
        />
        {onImportAsReply && (
          <ClaudeLogImporter
            onImport={(logContent) => onImportAsReply(id, logContent)}
            linkedSessionId={claudeSessionId}
            linkedProjectPath={claudeProjectPath}
            trigger={
              <button className="claude-import-button" title="ログを返信として取込">
                <FileDown size={16} style={{ display: 'inline-block', marginRight: '4px' }} />
                ログ取込
              </button>
            }
          />
        )}
        {onLinkClaudeSession && (
          <ClaudeSessionLinkDialog
            entryId={id}
            onLink={onLinkClaudeSession}
            trigger={
              <button
                className={`claude-link-button ${claudeSessionId ? 'linked' : ''}`}
                title={claudeSessionId ? `セッション: ${claudeSessionId}\ncwd: ${claudeCwd || 'N/A'}` : 'セッション紐付け'}
              >
                <Link size={16} style={{ display: 'inline-block', marginRight: '4px' }} />
                {claudeSessionId ? '紐付済' : '紐付け'}
              </button>
            }
          />
        )}
      </div>

      {replyingToId === id && (
        <div className="reply-input-section">
          <CustomInput
            value={replyContent}
            onChange={onReplyContentChange}
            onSubmit={() => onAddReply(id)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                onAddReply(id)
              }
            }}
            placeholder="返信を入力..."
            availableTags={availableTags}
            selectedTags={replyManualTags}
            onTagAdd={onReplyTagAdd}
            onTagRemove={onReplyTagRemove}
            frequentTags={frequentTags}
            recentTags={recentTags}
            additionalButtons={
              claudeSessionId && claudeCwd && replyContent.trim() && (
                <button
                  className="claude-resume-button-inline"
                  onClick={async () => {
                    try {
                      await resumeClaudeCode(claudeSessionId, claudeCwd, replyContent)
                      onAddReply(id) // 返信も追加
                    } catch (error) {
                      console.error('Failed to resume Claude Code session:', error)
                    }
                  }}
                  title="返信内容をプロンプトとしてセッションを再開"
                >
                  <Terminal size={16} style={{ display: 'inline-block', marginRight: '4px' }} />
                  セッション続行
                </button>
              )
            }
          />
        </div>
      )}

      {expandedReplies && replies && replies.length > 0 && (
        <div className="entry-replies-list">
          {replies
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map((reply) => (
              <div key={reply.id} className="entry-reply-item">
                <div className="entry-reply-time">{formatTimestamp(reply.timestamp)}</div>
                <div className="entry-reply-text">{reply.content}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
