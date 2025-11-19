import { useState, useEffect } from 'react'
import { Trash2, Pencil, X, Pin, FileCode, Type, Terminal as TerminalIcon } from 'lucide-react'
import CustomInput from '@/components/CustomInput'
import { TagBadge } from '@/components/TagBadge'
import { formatTimestamp } from '@/utils/dateUtils'
import { Reply, Tag } from '@/types'
import MarkdownPreview from '@/components/MarkdownPreview'
import { Terminal } from '@/components/Terminal'
import { useTerminalSessions } from '@/hooks/useTerminalSessions'
import Database from '@tauri-apps/plugin-sql'

interface EntryCardProps {
  database: Database | null
  id: number
  content: string
  tags?: Tag[]
  replyCount?: number
  replies?: Reply[]
  pinned?: boolean
  isEditing: boolean
  editContent: string
  editManualTags: string[]
  availableTags: Tag[]
  selectedTags: string[]
  replyingToId: number | null
  replyContent: string
  replyManualTags: string[]
  expandedReplies: boolean
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
}

export function EntryCard({
  database,
  id,
  content,
  tags,
  replyCount,
  replies,
  pinned,
  isEditing,
  editContent,
  editManualTags,
  availableTags,
  selectedTags,
  replyingToId,
  replyContent,
  replyManualTags,
  expandedReplies,
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
}: EntryCardProps) {
  const [showMarkdown, setShowMarkdown] = useState(true)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const { loadSession, createSession, updateSessionOutput } = useTerminalSessions(database)
  const [session, setSession] = useState<{ id: number, output: string } | null>(null)

  useEffect(() => {
    if (terminalOpen) {
      loadSession(id).then(s => {
        if (s) {
          setSession(s)
        } else {
          // Create new session if none exists
          // We don't create it immediately here, we let Terminal component handle initial command
          // But we need a session ID to save output.
          // So we create a session first.
          createSession(id, '').then(newSession => {
            if (newSession) setSession(newSession)
          })
        }
      })
    }
  }, [terminalOpen, id, loadSession, createSession])

  const handleTerminalOutput = (output: string) => {
    if (session) {
      updateSessionOutput(session.id, id, output)
    }
  }

  return (
    <div className={`entry-card ${pinned ? 'pinned' : ''}`}>
      <button
        className="edit-button"
        onClick={() => isEditing ? onCancelEdit() : onEdit(id, content)}
        aria-label={isEditing ? "キャンセル" : "編集"}
      >
        {isEditing ? <X size={16} /> : <Pencil size={16} />}
      </button>
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
        className={`terminal-button ${terminalOpen ? 'active' : ''}`}
        onClick={() => setTerminalOpen(!terminalOpen)}
        aria-label="Claudeで実行"
        style={{ position: 'absolute', top: '8px', right: '104px', background: 'none', border: 'none', cursor: 'pointer', color: terminalOpen ? '#4ade80' : '#6b7280' }}
      >
        <TerminalIcon size={16} />
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
            placeholder="エントリーを編集..."
            availableTags={availableTags}
            selectedTags={editManualTags}
            onTagAdd={onEditTagAdd}
            onTagRemove={onEditTagRemove}
          />
        </div>
      ) : (
        <>
          {showMarkdown ? (
            <MarkdownPreview content={content} className="entry-text" />
          ) : (
            <div className="entry-text">{content}</div>
          )}
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

      {terminalOpen && session && (
        <div className="entry-terminal" style={{ height: '300px', marginTop: '10px', border: '1px solid #333', borderRadius: '4px', overflow: 'hidden' }}>
          <Terminal
            initialCommand={session.output ? undefined : `claude -p "${content.replace(/"/g, '\\"')}"`}
            initialContent={session.output}
            onOutput={handleTerminalOutput}
          />
        </div>
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
