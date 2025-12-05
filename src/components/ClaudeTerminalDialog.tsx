import { useState, useEffect, useRef } from 'react'
import { ClaudeTerminal, type ClaudeTerminalHandle } from './ClaudeTerminal'
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

interface ClaudeTerminalDialogProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 紐付けられたセッションID（ある場合は続きから再開） */
  linkedSessionId?: string | null
  /** 紐付けられた作業ディレクトリ */
  linkedCwd?: string | null
}

export function ClaudeTerminalDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  linkedSessionId,
  linkedCwd,
}: ClaudeTerminalDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  // 制御モードかどうかを判定
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled
    ? (v: boolean) => controlledOnOpenChange?.(v)
    : setInternalOpen

  const [cwd, setCwd] = useState('')
  const [showTerminal, setShowTerminal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const terminalRef = useRef<ClaudeTerminalHandle>(null)

  // Context を使用
  const {
    createSession,
    activeSessionId,
    getSession,
    terminateSession,
    setDialogOpen,
  } = useClaudeTerminalSession()

  // 内部セッションID（Context モード用）
  const [contextSessionId, setContextSessionId] = useState<string | null>(null)

  // セッションが紐付けられている場合は自動的にターミナルを表示
  const hasLinkedSession = linkedSessionId && linkedCwd

  useEffect(() => {
    if (open && hasLinkedSession) {
      setCwd(linkedCwd)
      setShowTerminal(true)
    }
  }, [open, hasLinkedSession, linkedCwd])

  // ダイアログの開閉状態を Context に同期（非制御モードの場合のみ）
  // 制御モードでは Context が既にソースなので同期不要
  useEffect(() => {
    if (!isControlled) {
      setDialogOpen(open)
    }
  }, [open, setDialogOpen, isControlled])

  // activeSessionId が存在する場合、再接続
  useEffect(() => {
    if (open && activeSessionId && !contextSessionId) {
      const session = getSession(activeSessionId)
      if (session && session.status !== 'stopped') {
        setContextSessionId(activeSessionId)
        setCwd(session.cwd)
        setShowTerminal(true)
      }
    }
  }, [open, activeSessionId, contextSessionId, getSession])

  const handleLaunch = async () => {
    if (!cwd.trim()) return
    setError(null)
    setIsCreatingSession(true)

    try {
      // Context 経由でセッションを作成
      const sessionId = await createSession(cwd.trim(), hasLinkedSession ? linkedSessionId : undefined)
      setContextSessionId(sessionId)
      setShowTerminal(true)
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {!showTerminal ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cwd">作業ディレクトリ</Label>
              <Input
                id="cwd"
                placeholder="/path/to/project"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && cwd.trim() && !isCreatingSession) {
                    handleLaunch()
                  }
                }}
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
