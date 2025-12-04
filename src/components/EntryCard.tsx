import { useState } from 'react'
import { Trash2, X, Pin, FileCode, Type, Archive, Terminal, FileDown, Link, Loader2, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  runningSessionIds?: Set<string>
  onSessionStart?: (sessionId: string) => void
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
  runningSessionIds = new Set(),
  onSessionStart,
}: EntryCardProps) {
  const [showMarkdown, setShowMarkdown] = useState(true)
  const [claudeLaunchOpen, setClaudeLaunchOpen] = useState(false)
  const [claudeImportOpen, setClaudeImportOpen] = useState(false)
  const [claudeLinkOpen, setClaudeLinkOpen] = useState(false)

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

  // 実行中かどうか
  const isRunning = claudeSessionId ? runningSessionIds.has(claudeSessionId) : false

  return (
    <div className={`entry-card ${pinned ? 'pinned' : ''} ${isRunning ? 'running' : ''}`}>
      {isRunning && (
        <div className="running-badge">
          <Loader2 size={12} className="running-spinner" />
          実行中
        </div>
      )}
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
            enableTaskConversion={true}
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

        {/* Claudeドロップダウンメニュー */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`claude-menu-button ${claudeSessionId ? 'has-linked' : ''}`}>
              <MoreHorizontal size={16} />
              Claude
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setClaudeLaunchOpen(true)}>
              <Terminal size={16} className="mr-2" />
              Claude Code
            </DropdownMenuItem>
            {onImportAsReply && (
              <DropdownMenuItem onSelect={() => setClaudeImportOpen(true)}>
                <FileDown size={16} className="mr-2" />
                ログ取込
              </DropdownMenuItem>
            )}
            {onLinkClaudeSession && (
              <DropdownMenuItem onSelect={() => setClaudeLinkOpen(true)}>
                <Link size={16} className="mr-2" />
                {claudeSessionId ? '紐付済' : '紐付け'}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogコンポーネント（triggerなしで配置） */}
      <ClaudeLaunchDialog
        initialPrompt={content}
        open={claudeLaunchOpen}
        onOpenChange={setClaudeLaunchOpen}
      />
      {onImportAsReply && (
        <ClaudeLogImporter
          onImport={(logContent) => onImportAsReply(id, logContent)}
          linkedSessionId={claudeSessionId}
          linkedProjectPath={claudeProjectPath}
          open={claudeImportOpen}
          onOpenChange={setClaudeImportOpen}
        />
      )}
      {onLinkClaudeSession && (
        <ClaudeSessionLinkDialog
          entryId={id}
          onLink={onLinkClaudeSession}
          open={claudeLinkOpen}
          onOpenChange={setClaudeLinkOpen}
        />
      )}

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
              claudeSessionId && claudeCwd && (
                <button
                  className={`claude-resume-button-inline ${isRunning ? 'running' : ''}`}
                  onClick={async () => {
                    if (isRunning) return
                    try {
                      const prompt = replyContent.trim() || undefined
                      onSessionStart?.(claudeSessionId)
                      await resumeClaudeCode(claudeSessionId, claudeCwd, prompt)
                      if (prompt) {
                        onAddReply(id) // 返信内容がある場合のみ追加
                      }
                    } catch (error) {
                      console.error('Failed to resume Claude Code session:', error)
                    }
                  }}
                  title={isRunning ? "セッション実行中" : !replyContent.trim() ? "返信内容を入力してください" : "セッションを再開（返信内容をプロンプトとして使用）"}
                  disabled={isRunning || !replyContent.trim()}
                >
                  {isRunning ? (
                    <>
                      <Loader2 size={16} className="running-spinner" style={{ display: 'inline-block', marginRight: '4px' }} />
                      実行中...
                    </>
                  ) : (
                    <>
                      <Terminal size={16} style={{ display: 'inline-block', marginRight: '4px' }} />
                      セッション続行
                    </>
                  )}
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
