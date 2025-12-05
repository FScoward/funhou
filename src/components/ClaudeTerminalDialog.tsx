import { useState, useEffect } from 'react'
import { ClaudeTerminal } from './ClaudeTerminal'
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

  // セッションが紐付けられている場合は自動的にターミナルを表示
  const hasLinkedSession = linkedSessionId && linkedCwd

  useEffect(() => {
    if (open && hasLinkedSession) {
      setCwd(linkedCwd)
      setShowTerminal(true)
    }
  }, [open, hasLinkedSession, linkedCwd])

  const handleLaunch = () => {
    if (!cwd.trim()) return
    setError(null)
    setShowTerminal(true)
  }

  const handleReset = () => {
    setShowTerminal(false)
    setError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // ダイアログが閉じられたらリセット
      setShowTerminal(false)
      setCwd('')
      setError(null)
    }
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  const dialogTitle = hasLinkedSession
    ? 'Claude Code Terminal（セッション続行）'
    : 'Claude Code Terminal'

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
                  if (e.key === 'Enter' && cwd.trim()) {
                    handleLaunch()
                  }
                }}
              />
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}

            <Button onClick={handleLaunch} disabled={!cwd.trim()}>
              起動
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {error && (
              <div className="mb-2 text-sm text-red-500 flex-shrink-0">{error}</div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <ClaudeTerminal
                cwd={cwd}
                sessionId={hasLinkedSession ? linkedSessionId : undefined}
                onError={handleError}
              />
            </div>
            <div className="mt-2 pt-2 border-t flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleReset}>
                新しいセッション
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
