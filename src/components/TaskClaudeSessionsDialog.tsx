import { useState, useRef, useEffect } from 'react'
import { TaskClaudeSession } from '@/types'
import { resumeClaudeCode, getClaudeSessionLog, getClaudeSessionsForProject, SessionSummary } from '../lib/claudeLogs'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Terminal, Play, Trash2, Plus, ChevronDown, Pencil, Check, X, FileText, Link } from 'lucide-react'

interface TaskClaudeSessionsDialogProps {
  taskText: string
  sessions: TaskClaudeSession[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSessionResumed: () => void
  onSessionUnlinked: (sessionId: string) => void
  onSessionNameChanged: (sessionId: string, name: string | null) => void
  /** Claude CodeのセッションIDを更新（ログ紐付け用） */
  onSessionIdUpdated: (oldSessionId: string, newSessionId: string) => void
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
  onSessionNameChanged,
  onSessionIdUpdated,
  onLaunchNew,
  onResumeInApp,
}: TaskClaudeSessionsDialogProps) {
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 再開メニュー用の状態
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuSession, setMenuSession] = useState<TaskClaudeSession | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 名前編集用の状態
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // ログ表示用の状態
  const [logDialogOpen, setLogDialogOpen] = useState(false)
  const [logSession, setLogSession] = useState<TaskClaudeSession | null>(null)
  const [logContent, setLogContent] = useState<string | null>(null)
  const [logLoading, setLogLoading] = useState(false)
  const [logNotFound, setLogNotFound] = useState(false)

  // ログ紐付け用の状態
  const [availableSessions, setAvailableSessions] = useState<SessionSummary[]>([])
  const [loadingAvailableSessions, setLoadingAvailableSessions] = useState(false)
  const [showLinkPicker, setShowLinkPicker] = useState(false)

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

  // 名前編集を開始
  const handleStartEditName = (session: TaskClaudeSession) => {
    setEditingSessionId(session.sessionId)
    setEditingName(session.name || '')
  }

  // 名前編集を保存
  const handleSaveName = (sessionId: string) => {
    const trimmedName = editingName.trim()
    onSessionNameChanged(sessionId, trimmedName || null)
    setEditingSessionId(null)
    setEditingName('')
  }

  // 名前編集をキャンセル
  const handleCancelEditName = () => {
    setEditingSessionId(null)
    setEditingName('')
  }

  // ログを表示
  const handleShowLog = async (session: TaskClaudeSession) => {
    setLogSession(session)
    setLogDialogOpen(true)
    setLogLoading(true)
    setLogContent(null)
    setLogNotFound(false)
    setAvailableSessions([])
    setShowLinkPicker(false)

    try {
      const log = await getClaudeSessionLog(session.sessionId, session.projectPath)
      if (log) {
        setLogContent(log)
      } else {
        setLogContent(null)
      }
    } catch (err) {
      console.error('ログの取得に失敗しました:', err)
      setLogContent(null)
      setLogNotFound(true)
      // ログが見つからない場合、紐付け可能なセッション一覧を取得
      await loadAvailableSessions(session.projectPath)
    } finally {
      setLogLoading(false)
    }
  }

  // 紐付け可能なセッション一覧を取得
  const loadAvailableSessions = async (projectPath: string) => {
    setLoadingAvailableSessions(true)
    try {
      const sessions = await getClaudeSessionsForProject(projectPath)
      setAvailableSessions(sessions)
    } catch (err) {
      console.error('セッション一覧の取得に失敗しました:', err)
      setAvailableSessions([])
    } finally {
      setLoadingAvailableSessions(false)
    }
  }

  // セッションIDを紐付け
  const handleLinkSession = async (claudeSessionId: string) => {
    if (logSession) {
      onSessionIdUpdated(logSession.sessionId, claudeSessionId)
      // 紐付け後、ログを表示
      setLogLoading(true)
      setLogNotFound(false)
      setShowLinkPicker(false)
      try {
        const log = await getClaudeSessionLog(claudeSessionId, logSession.projectPath)
        setLogContent(log || null)
      } catch (err) {
        console.error('ログの取得に失敗しました:', err)
        setLogContent(null)
      } finally {
        setLogLoading(false)
      }
    }
  }

  // 紐付けを変更
  const handleChangeLinkClick = async () => {
    if (logSession) {
      setShowLinkPicker(true)
      await loadAvailableSessions(logSession.projectPath)
    }
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
      <DialogContent className="sm:max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal size={18} />
            セッション管理
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">タスク</div>
            <div className="p-2 bg-muted rounded text-sm break-words">
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
              <div className="space-y-2 max-h-60 overflow-y-auto overflow-x-hidden">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="p-3 border rounded hover:bg-muted/50 transition-colors overflow-hidden"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        {/* セッション名の表示・編集 */}
                        {editingSessionId === session.sessionId ? (
                          <div className="flex items-center gap-1 mb-1">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              placeholder="セッション名を入力"
                              className="h-6 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveName(session.sessionId)
                                } else if (e.key === 'Escape') {
                                  handleCancelEditName()
                                }
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveName(session.sessionId)}
                              className="h-6 w-6 p-0"
                              title="保存"
                            >
                              <Check size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEditName}
                              className="h-6 w-6 p-0"
                              title="キャンセル"
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mb-1">
                            {session.name ? (
                              <span className="text-sm font-medium">{session.name}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">名前なし</span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEditName(session)}
                              className="h-5 w-5 p-0"
                              title="名前を編集"
                            >
                              <Pencil size={10} />
                            </Button>
                          </div>
                        )}
                        <div className="font-mono text-xs text-muted-foreground">
                          {truncateSessionId(session.sessionId)}
                        </div>
                        <div className="text-sm break-all mt-1">
                          {session.cwd}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(session.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 relative flex-shrink-0">
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
                                  className="checkbox-status-option whitespace-nowrap"
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
                                className="checkbox-status-option whitespace-nowrap"
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
                          onClick={() => handleShowLog(session)}
                          title="ログを表示"
                        >
                          <FileText size={14} />
                        </Button>
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

      {/* ログ表示ダイアログ */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={18} />
              セッションログ
              {logSession?.name && (
                <span className="text-muted-foreground font-normal">- {logSession.name}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {logSession && (
              <div className="text-xs text-muted-foreground">
                セッションID: {logSession.sessionId}
              </div>
            )}
            <div className="bg-muted rounded p-3 max-h-[50vh] overflow-y-auto">
              {logLoading ? (
                <div className="text-center text-muted-foreground py-4">
                  ログを読み込み中...
                </div>
              ) : showLinkPicker ? (
                // 紐付け変更モード
                <div className="space-y-4">
                  <div className="text-center text-muted-foreground py-2">
                    <div>紐付けるClaude Codeセッションを選択してください</div>
                  </div>
                  {loadingAvailableSessions ? (
                    <div className="text-center text-muted-foreground py-2">
                      セッション一覧を読み込み中...
                    </div>
                  ) : availableSessions.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {availableSessions.map((session) => (
                        <div
                          key={session.session_id}
                          className="p-2 border rounded hover:bg-background/50 cursor-pointer transition-colors"
                          onClick={() => handleLinkSession(session.session_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-xs text-muted-foreground">
                                {session.session_id.slice(0, 8)}...
                              </div>
                              {session.first_message && (
                                <div className="text-xs truncate mt-1" title={session.first_message}>
                                  {session.first_message}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {session.timestamp ? formatTimestamp(session.timestamp) : '日時不明'}
                                {session.message_count > 0 && ` • ${session.message_count}メッセージ`}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" title="このセッションを紐付け">
                              <Link size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-2 text-xs">
                      紐付け可能なセッションがありません
                    </div>
                  )}
                </div>
              ) : logContent ? (
                <pre className="text-xs whitespace-pre-wrap font-mono">{logContent}</pre>
              ) : logNotFound ? (
                <div className="space-y-4">
                  <div className="text-center text-muted-foreground py-2">
                    <div>ログが見つかりませんでした</div>
                    <div className="text-xs mt-1">
                      下記のClaude Codeセッションから紐付けを選択してください
                    </div>
                  </div>
                  {loadingAvailableSessions ? (
                    <div className="text-center text-muted-foreground py-2">
                      セッション一覧を読み込み中...
                    </div>
                  ) : availableSessions.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {availableSessions.map((session) => (
                        <div
                          key={session.session_id}
                          className="p-2 border rounded hover:bg-background/50 cursor-pointer transition-colors"
                          onClick={() => handleLinkSession(session.session_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-xs text-muted-foreground">
                                {session.session_id.slice(0, 8)}...
                              </div>
                              {session.first_message && (
                                <div className="text-xs truncate mt-1" title={session.first_message}>
                                  {session.first_message}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {session.timestamp ? formatTimestamp(session.timestamp) : '日時不明'}
                                {session.message_count > 0 && ` • ${session.message_count}メッセージ`}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" title="このセッションを紐付け">
                              <Link size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-2 text-xs">
                      紐付け可能なセッションがありません
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  ログがありません
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {logContent && !showLinkPicker && (
              <Button variant="outline" onClick={handleChangeLinkClick}>
                <Link size={14} className="mr-1" />
                紐付けを変更
              </Button>
            )}
            {showLinkPicker && (
              <Button variant="outline" onClick={() => setShowLinkPicker(false)}>
                キャンセル
              </Button>
            )}
            <Button variant="outline" onClick={() => setLogDialogOpen(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
