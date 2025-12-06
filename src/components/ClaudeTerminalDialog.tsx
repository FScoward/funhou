import { useState, useEffect, useRef } from 'react'
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

interface ClaudeTerminalDialogProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 紐付けられたセッションID（ある場合は続きから再開） */
  linkedSessionId?: string | null
  /** 紐付けられた作業ディレクトリ */
  linkedCwd?: string | null
  /** Widgetから開いた場合はtrue（自動再接続を許可） */
  fromWidget?: boolean
  /** セッション作成時に呼ばれるコールバック（セッションID、作業ディレクトリ） */
  onSessionCreated?: (sessionId: string, cwd: string) => void
}

export function ClaudeTerminalDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  linkedSessionId,
  linkedCwd,
  fromWidget = false,
  onSessionCreated,
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
  const hasLinkedSession = linkedSessionId && linkedCwd

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

  // ダイアログが開いた時の初期化処理
  useEffect(() => {
    if (!open || fromWidget) return

    if (hasLinkedSession) {
      // セッション再開の場合
      console.log('[ClaudeTerminalDialog] Opening for session resume:', {
        linkedSessionId,
        linkedCwd,
      })

      setShowTerminal(false)
      setError(null)
      setCwd(linkedCwd!)

      // 既存のアクティブセッションを探す（同じclaudeSessionIdを持つもの）
      const activeSessions = getActiveSessions()
      console.log('[ClaudeTerminalDialog] Active sessions:', activeSessions.map(s => ({
        id: s.id,
        claudeSessionId: s.claudeSessionId,
        status: s.status,
      })))

      const existingSession = activeSessions.find(
        (s) => s.claudeSessionId === linkedSessionId
      )
      console.log('[ClaudeTerminalDialog] Looking for claudeSessionId:', linkedSessionId)
      console.log('[ClaudeTerminalDialog] Found existing session:', existingSession)

      if (existingSession) {
        // 既存セッションを再利用（同じClaudeセッションIDで既に起動中の場合）
        console.log('[ClaudeTerminalDialog] Reusing existing session:', existingSession.id)
        setContextSessionId(existingSession.id)
        setShowTerminal(true)
      } else {
        // 新規作成（resumeモード）
        console.log('[ClaudeTerminalDialog] Creating new session with resume')
        setIsCreatingSession(true)
        createSession(linkedCwd!, linkedSessionId!)
          .then((sessionId) => {
            console.log('[ClaudeTerminalDialog] Session created:', sessionId)
            setContextSessionId(sessionId)
            setShowTerminal(true)
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err)
            console.error('[ClaudeTerminalDialog] Session creation failed:', message)
            setError(`セッションの作成に失敗しました: ${message}`)
          })
          .finally(() => {
            setIsCreatingSession(false)
          })
      }
    } else {
      // 新規起動の場合は全てリセット
      setCwd('')
      setSessionName('')
      setShowTerminal(false)
      setContextSessionId(null)
      setError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromWidget, linkedSessionId, linkedCwd])  // createSession, getActiveSessions, hasLinkedSessionは意図的に除外

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

      // セッション作成を通知
      onSessionCreated?.(sessionId, cwd.trim())
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
    : contextSessionId && activeSessionId === contextSessionId
      ? 'Claude Code Terminal（バックグラウンドから復帰）'
      : 'Claude Code Terminal'

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

        {!showTerminal ? (
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
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <ClaudeTerminal
                ref={terminalRef}
                cwd={cwd}
                sessionId={hasLinkedSession ? linkedSessionId : undefined}
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
