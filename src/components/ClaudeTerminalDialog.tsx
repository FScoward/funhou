import { useState, useEffect, useRef, useMemo } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { ClaudeTerminal, type ClaudeTerminalHandle } from './ClaudeTerminal'
import { CwdSelector } from './CwdSelector'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useClaudeTerminalSession } from '../contexts/ClaudeTerminalSessionContext'
import { getSettings } from '../lib/settings'
import { listClaudeProjects, listClaudeSessions, readClaudeSession, type ProjectInfo, type SessionSummary } from '../lib/claudeLogs'

interface ClaudeTerminalDialogProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 紐付けられたClaude CodeのセッションID（ある場合は続きから再開） */
  linkedSessionId?: string | null
  /** 紐付けられた作業ディレクトリ */
  linkedCwd?: string | null
  /** 紐付けられたClaude Codeのプロジェクトパス（セッション存在確認に使用） */
  linkedProjectPath?: string | null
  /** 紐付けられたPTYセッションID（アクティブなら再接続） */
  linkedPtySessionId?: string | null
  /** Widgetから開いた場合はtrue（自動再接続を許可） */
  fromWidget?: boolean
  /** セッション作成時に呼ばれるコールバック（Claude CodeのセッションID、作業ディレクトリ、プロジェクトパス） */
  onSessionCreated?: (claudeSessionId: string, cwd: string, projectPath: string) => void
  /** PTYセッション作成時に呼ばれるコールバック（DBに保存するため） */
  onPtySessionCreated?: (claudeSessionId: string, ptySessionId: string) => void
  /** セッション選択画面をスキップ（新規起動用） */
  skipSessionSelector?: boolean
}

export function ClaudeTerminalDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  linkedSessionId,
  linkedCwd,
  linkedProjectPath,
  linkedPtySessionId,
  fromWidget = false,
  onSessionCreated,
  onPtySessionCreated,
  skipSessionSelector = false,
}: ClaudeTerminalDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  // 制御モードかどうかを判定
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled
    ? (v: boolean) => controlledOnOpenChange?.(v)
    : setInternalOpen

  const [cwd, setCwd] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [showTerminal, setShowTerminal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [defaultClaudeCwd, setDefaultClaudeCwd] = useState<string | undefined>(undefined)
  const terminalRef = useRef<ClaudeTerminalHandle>(null)

  // セッション紐付け選択用の状態
  const [showSessionSelector, setShowSessionSelector] = useState(false)
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null)
  const [selectorView, setSelectorView] = useState<'projects' | 'sessions'>('projects')
  const [selectorLoading, setSelectorLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // 選択されたセッション情報（紐付け用）
  const [selectedClaudeSession, setSelectedClaudeSession] = useState<{ sessionId: string; cwd: string } | null>(null)

  // Context を使用
  const {
    createSession,
    activeSessionId,
    getSession,
    getActiveSessions,
    terminateSession,
    setDialogOpen,
  } = useClaudeTerminalSession()

  // 内部セッションID（Context モード用）
  const [contextSessionId, setContextSessionId] = useState<string | null>(null)

  // セッションが紐付けられている場合は自動的にターミナルを表示
  const hasLinkedSession = linkedSessionId && linkedCwd && linkedProjectPath

  // デフォルトcwd設定を読み込み
  useEffect(() => {
    async function loadDefaultCwd() {
      try {
        const db = await Database.load('sqlite:funhou.db')
        const settings = await getSettings(db)
        if (settings.defaultClaudeCwd) {
          setDefaultClaudeCwd(settings.defaultClaudeCwd)
        }
      } catch (error) {
        console.error('デフォルトcwd設定の読み込みに失敗しました:', error)
      }
    }
    loadDefaultCwd()
  }, [])

  // セッションがClaude Code側に存在するか確認
  const checkSessionExists = async (sessionId: string, projectPath: string): Promise<boolean> => {
    console.log('[ClaudeTerminalDialog] checkSessionExists:', { sessionId, projectPath })
    try {
      const messages = await readClaudeSession(projectPath, sessionId)
      console.log('[ClaudeTerminalDialog] Session found, messages:', messages.length)
      return messages.length > 0
    } catch (err) {
      console.log('[ClaudeTerminalDialog] Session not found:', err)
      return false
    }
  }

  // ダイアログが開いた時の初期化処理
  useEffect(() => {
    if (!open || fromWidget) return

    // 非同期処理の前に同期的に状態をリセット（ターミナルが表示されるのを防ぐ）
    setShowTerminal(false)
    setContextSessionId(null)
    setShowSessionSelector(false)
    setError(null)

    const initializeDialog = async () => {
      if (hasLinkedSession) {
        // セッション再開の場合
        console.log('[ClaudeTerminalDialog] Opening for session resume:', {
          linkedSessionId,
          linkedCwd,
        })

        setCwd(linkedCwd!)

        // Claude Code側にセッションが存在するか確認
        console.log('[ClaudeTerminalDialog] Checking if session exists in Claude Code...', { linkedSessionId, linkedProjectPath })
        const sessionExists = await checkSessionExists(linkedSessionId!, linkedProjectPath!)

        if (!sessionExists) {
          // セッションが存在しない場合、セッション選択画面を表示
          console.log('[ClaudeTerminalDialog] Session not found in Claude Code, showing selector')
          setError('セッションが見つかりません。別のセッションを選択してください。')
          setShowSessionSelector(true)
          setSelectorView('projects')
          setSelectedProject(null)
          setSearchQuery('')
          loadProjects()
          return
        }

        // セッションが存在する場合
        console.log('[ClaudeTerminalDialog] Session exists in Claude Code')

        // linkedPtySessionIdが指定されている場合、そのPTYセッションがアクティブか確認
        if (linkedPtySessionId) {
          const existingPtySession = getSession(linkedPtySessionId)
          if (existingPtySession && existingPtySession.status !== 'stopped') {
            console.log('[ClaudeTerminalDialog] Reusing existing PTY session:', linkedPtySessionId)
            setContextSessionId(linkedPtySessionId)
            setShowTerminal(true)
            return
          }
          console.log('[ClaudeTerminalDialog] Linked PTY session not active:', linkedPtySessionId)
        }

        // 既存のアクティブセッションを探す（同じclaudeSessionIdを持つもの）
        const activeSessions = getActiveSessions()
        const existingSession = activeSessions.find(
          (s) => s.claudeSessionId === linkedSessionId
        )

        if (existingSession) {
          // 既存セッションを再利用（同じClaudeセッションIDで既に起動中の場合）
          console.log('[ClaudeTerminalDialog] Reusing existing session:', existingSession.id)
          setContextSessionId(existingSession.id)
          setShowTerminal(true)
          return
        }

        // 新しいセッションを作成してresumeモードで起動
        console.log('[ClaudeTerminalDialog] Creating new session with resume')
        setIsCreatingSession(true)
        try {
          const ptySessionId = await createSession(linkedCwd!, linkedSessionId!)
          console.log('[ClaudeTerminalDialog] Session created:', ptySessionId)
          setContextSessionId(ptySessionId)
          setShowTerminal(true)
          // PTYセッション作成をDBに通知
          onPtySessionCreated?.(linkedSessionId!, ptySessionId)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[ClaudeTerminalDialog] Session creation failed:', message)
          setError(`セッションの作成に失敗しました: ${message}`)
        } finally {
          setIsCreatingSession(false)
        }
      } else {
        // 紐付けがない場合
        setCwd('')
        setSessionName('')
        setShowTerminal(false)
        setContextSessionId(null)
        setError(null)
        setSelectedClaudeSession(null)

        if (skipSessionSelector) {
          // 新規起動の場合はセッション選択をスキップして直接入力画面を表示
          setShowSessionSelector(false)
        } else {
          // セッション選択画面を表示してプロジェクト一覧を読み込む
          setShowSessionSelector(true)
          setSelectorView('projects')
          setSelectedProject(null)
          setSearchQuery('')
          loadProjects()
        }
      }
    }

    initializeDialog()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromWidget, linkedSessionId, linkedCwd, linkedProjectPath, linkedPtySessionId, skipSessionSelector])  // createSession, getActiveSessions, getSession, hasLinkedSession, onPtySessionCreatedは意図的に除外

  // プロジェクト一覧の読み込み
  const loadProjects = async () => {
    setSelectorLoading(true)
    try {
      const result = await listClaudeProjects()
      setProjects(result)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setSelectorLoading(false)
    }
  }

  // プロジェクト選択時のセッション読み込み
  const handleProjectSelect = async (project: ProjectInfo) => {
    setSelectedProject(project)
    setSelectorLoading(true)
    try {
      const result = await listClaudeSessions(project.path)
      setSessions(result)
      setSelectorView('sessions')
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setSelectorLoading(false)
    }
  }

  // セッション選択時の処理（選択のみ、ターミナル起動はしない）
  const handleSessionSelect = (session: SessionSummary) => {
    if (!session.cwd) return
    setSelectedClaudeSession({ sessionId: session.session_id, cwd: session.cwd })
    setCwd(session.cwd)
    setShowSessionSelector(false)
    // セッション情報を通知（DBに保存するため）- ターミナルは起動しない
    onSessionCreated?.(session.session_id, session.cwd!, session.project_path)
  }

  // 新規セッション作成を選択（resumeなしで即起動）
  const handleNewSession = async () => {
    setShowSessionSelector(false)
    setSelectedClaudeSession(null)

    // デフォルトcwdがあれば即起動
    const targetCwd = defaultClaudeCwd
    if (targetCwd) {
      setCwd(targetCwd)
      setIsCreatingSession(true)
      try {
        const sessionId = await createSession(targetCwd)
        setContextSessionId(sessionId)
        setShowTerminal(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`セッションの作成に失敗しました: ${message}`)
      } finally {
        setIsCreatingSession(false)
      }
    }
    // デフォルトcwdがない場合は従来の入力画面を表示（showSessionSelector=falseで自動的に表示）
  }

  // プロジェクト一覧に戻る
  const handleBackToProjects = () => {
    setSelectorView('projects')
    setSelectedProject(null)
  }

  // フィルタリングされたプロジェクト一覧
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const query = searchQuery.toLowerCase()
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query)
    )
  }, [projects, searchQuery])

  // ダイアログの開閉状態を Context に同期（非制御モードの場合のみ）
  // 制御モードでは Context が既にソースなので同期不要
  useEffect(() => {
    if (!isControlled) {
      setDialogOpen(open)
    }
  }, [open, setDialogOpen, isControlled])

  // activeSessionId が存在する場合、再接続
  // ただし、Widgetから開いた場合のみ再接続を許可（EntryCardからは新規セッション作成）
  useEffect(() => {
    // Widgetから開いた場合のみ自動再接続
    if (!fromWidget) return

    if (open && activeSessionId && !contextSessionId) {
      const session = getSession(activeSessionId)
      if (session && session.status !== 'stopped') {
        setContextSessionId(activeSessionId)
        setCwd(session.cwd)
        setShowTerminal(true)
      }
    }
  }, [open, activeSessionId, contextSessionId, getSession, fromWidget])

  const handleLaunch = async () => {
    if (!cwd.trim()) return
    setError(null)
    setIsCreatingSession(true)

    try {
      // Context 経由でセッションを作成
      const sessionId = await createSession(
        cwd.trim(),
        hasLinkedSession ? linkedSessionId : undefined,
        sessionName.trim() || undefined
      )
      setContextSessionId(sessionId)
      setShowTerminal(true)
      // 注意: 新規起動時はClaude CodeのセッションIDがまだわからないので
      // onSessionCreatedは呼ばない。後でユーザーがセッションを紐付ける必要がある
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`セッションの作成に失敗しました: ${message}`)
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleReset = async () => {
    // 現在のセッションを終了
    if (contextSessionId) {
      await terminateSession(contextSessionId, true)
    }
    setContextSessionId(null)
    setShowTerminal(false)
    setError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && contextSessionId) {
      // ダイアログを閉じる際、セッションはバックグラウンドで継続
      // xterm.js のみアンマウントされる
      console.log('[ClaudeTerminalDialog] Closing dialog, session continues in background:', contextSessionId)
    }

    setOpen(newOpen)

    if (!newOpen) {
      // ダイアログが閉じられたらUI状態をリセット（セッションは継続）
      setShowTerminal(false)
      setCwd('')
      setSessionName('')
      setError(null)
      // contextSessionId をリセット（再接続時は activeSessionId から復元）
      setContextSessionId(null)
    }
  }

  const handleTerminate = async () => {
    if (contextSessionId) {
      await terminateSession(contextSessionId, true)
      setContextSessionId(null)
    }
    setShowTerminal(false)
    setError(null)
    setOpen(false)
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  const dialogTitle = hasLinkedSession
    ? 'Claude Code Terminal（セッション続行）'
    : selectedClaudeSession
      ? 'Claude Code Terminal（セッション続行）'
      : contextSessionId && activeSessionId === contextSessionId
        ? 'Claude Code Terminal（バックグラウンドから復帰）'
        : showSessionSelector
          ? 'セッションを選択'
          : 'Claude Code Terminal'

  // タイムスタンプのフォーマット
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleString('ja-JP')
  }

  // テキストの切り詰め
  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // 現在のセッション状態を取得
  const currentSession = contextSessionId ? getSession(contextSessionId) : null
  const sessionStatus = currentSession?.status

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-4xl h-[80vh] flex flex-col overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {showSessionSelector ? (
          // セッション選択画面
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectorView === 'projects' && (
              <>
                <div className="mb-4">
                  <Input
                    placeholder="プロジェクトを検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {selectorLoading && (
                    <div className="p-4 text-center text-gray-500">読み込み中...</div>
                  )}
                  {!selectorLoading && filteredProjects.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      {projects.length === 0 ? 'プロジェクトが見つかりません' : '検索結果がありません'}
                    </div>
                  )}
                  {!selectorLoading && filteredProjects.map((project) => (
                    <div
                      key={project.path}
                      className="p-3 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => handleProjectSelect(project)}
                    >
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-gray-500 flex gap-4">
                        <span>{project.session_count} セッション</span>
                        {project.last_updated && (
                          <span>{formatTimestamp(project.last_updated)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {selectorView === 'sessions' && (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleBackToProjects}>
                    ← 戻る
                  </Button>
                  <span className="font-medium">{selectedProject?.name}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {selectorLoading && (
                    <div className="p-4 text-center text-gray-500">読み込み中...</div>
                  )}
                  {!selectorLoading && sessions.length === 0 && (
                    <div className="p-4 text-center text-gray-500">セッションが見つかりません</div>
                  )}
                  {!selectorLoading && sessions.map((session) => (
                    <div
                      key={session.session_id}
                      className={`p-3 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        !session.cwd ? 'opacity-50' : ''
                      }`}
                      onClick={() => session.cwd && handleSessionSelect(session)}
                    >
                      <div className="font-medium">
                        {truncateText(session.first_message, 50) || 'No message'}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-1">
                        {session.session_id}
                      </div>
                      <div className="text-sm text-gray-500 flex gap-4 mt-1">
                        <span>{formatTimestamp(session.timestamp)}</span>
                        {session.git_branch && <span>Branch: {session.git_branch}</span>}
                        <span>{session.message_count} メッセージ</span>
                      </div>
                      {!session.cwd && (
                        <div className="text-xs text-red-500 mt-1">cwdが見つかりません</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" onClick={handleNewSession}>
                新規セッションを作成
              </Button>
            </div>
          </div>
        ) : !showTerminal ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-name">セッション名（オプション）</Label>
              <Input
                id="session-name"
                placeholder="例: issue-123対応"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                disabled={isCreatingSession}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cwd">作業ディレクトリ</Label>
              <CwdSelector
                value={cwd}
                onChange={setCwd}
                defaultCwd={defaultClaudeCwd}
                disabled={isCreatingSession}
              />
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}

            <Button onClick={handleLaunch} disabled={!cwd.trim() || isCreatingSession}>
              {isCreatingSession ? '起動中...' : '起動'}
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {error && (
              <div className="mb-2 text-sm text-red-500 flex-shrink-0">{error}</div>
            )}
            {sessionStatus === 'error' && currentSession?.error && (
              <div className="mb-2 text-sm text-red-500 flex-shrink-0">
                エラー: {currentSession.error}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden relative bg-[#1e1e1e] rounded terminal-container-opaque">
              <ClaudeTerminal
                ref={terminalRef}
                cwd={cwd}
                onError={handleError}
                useContext={!!contextSessionId}
                contextSessionId={contextSessionId ?? undefined}
              />
            </div>
            <div className="mt-2 pt-2 border-t flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleReset}>
                新しいセッション
              </Button>
              <Button variant="destructive" size="sm" onClick={handleTerminate}>
                終了
              </Button>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground self-center">
                ダイアログを閉じてもバックグラウンドで実行継続
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
