import { useState, useRef, useEffect } from 'react'
import { TaskClaudeSession } from '@/types'
import { resumeClaudeCode } from '../lib/claudeLogs'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Terminal, Play, Trash2, Plus, ChevronDown } from 'lucide-react'

interface TaskClaudeSessionsDialogProps {
  taskText: string
  sessions: TaskClaudeSession[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSessionResumed: () => void
  onSessionUnlinked: (sessionId: string) => void
  onLaunchNew: () => void
  /** アプリ内ターミナルでセッションを再開 */
  onResumeInApp?: (session: TaskClaudeSession) => void
}

export function TaskClaudeSessionsDialog({
  taskText,
  sessions,
  open,
  onOpenChange,
  onSessionResumed,
  onSessionUnlinked,
  onLaunchNew,
  onResumeInApp,
}: TaskClaudeSessionsDialogProps) {
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 再開メニュー用の状態
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuSession, setMenuSession] = useState<TaskClaudeSession | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
        setMenuSession(null)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  // 外部ターミナルで再開
  const handleResumeExternal = async (session: TaskClaudeSession) => {
    setResumingSessionId(session.sessionId)
    setError(null)
    setMenuOpen(false)
    setMenuSession(null)

    try {
      await resumeClaudeCode(session.sessionId, session.cwd)
      onSessionResumed()
      onOpenChange(false)
    } catch (err) {
      console.error('セッション再開に失敗しました:', err)
      setError('セッションの再開に失敗しました')
    } finally {
      setResumingSessionId(null)
    }
  }

  // アプリ内ターミナルで再開
  const handleResumeInApp = (session: TaskClaudeSession) => {
    console.log('[TaskClaudeSessionsDialog] handleResumeInApp:', session)
    setMenuOpen(false)
    setMenuSession(null)
    if (onResumeInApp) {
      console.log('[TaskClaudeSessionsDialog] calling onResumeInApp')
      onResumeInApp(session)
      onOpenChange(false)
    } else {
      console.log('[TaskClaudeSessionsDialog] onResumeInApp is not defined!')
    }
  }

  // 再開ボタンクリック（メニューを表示）
  const handleResumeClick = (_e: React.MouseEvent, session: TaskClaudeSession) => {
    // 同じセッションをクリックした場合はトグル
    if (menuOpen && menuSession?.sessionId === session.sessionId) {
      setMenuOpen(false)
      setMenuSession(null)
    } else {
      setMenuSession(session)
      setMenuOpen(true)
    }
  }

  const handleUnlink = (sessionId: string) => {
    onSessionUnlinked(sessionId)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const truncateSessionId = (sessionId: string) => {
    if (sessionId.length <= 12) return sessionId
    return `${sessionId.slice(0, 6)}...${sessionId.slice(-4)}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal size={18} />
            セッション管理
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">タスク</div>
            <div className="p-2 bg-muted rounded text-sm">
              {taskText}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                紐付けられたセッション ({sessions.length})
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onLaunchNew()
                }}
              >
                <Plus size={14} className="mr-1" />
                新規起動
              </Button>
            </div>

            {sessions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground border rounded">
                紐付けられたセッションはありません
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="p-3 border rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-muted-foreground">
                          {truncateSessionId(session.sessionId)}
                        </div>
                        <div className="text-sm truncate mt-1" title={session.cwd}>
                          {session.cwd}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(session.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 relative">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleResumeClick(e, session)}
                            disabled={resumingSessionId === session.sessionId}
                            title="セッションを再開"
                            className="flex items-center gap-1"
                          >
                            <Play size={14} />
                            <ChevronDown size={12} />
                          </Button>
                          {/* インラインドロップダウンメニュー */}
                          {menuOpen && menuSession?.sessionId === session.sessionId && (
                            <div
                              ref={menuRef}
                              className="checkbox-status-menu"
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                zIndex: 50,
                              }}
                            >
                              {onResumeInApp && (
                                <button
                                  className="checkbox-status-option"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleResumeInApp(menuSession)
                                  }}
                                >
                                  <Terminal size={14} />
                                  <span>アプリ内で再開</span>
                                </button>
                              )}
                              <button
                                className="checkbox-status-option"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleResumeExternal(menuSession)
                                }}
                              >
                                <Terminal size={14} />
                                <span>外部ターミナルで再開</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlink(session.sessionId)}
                          title="紐付けを解除"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="text-sm text-red-500">{error}</div>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
