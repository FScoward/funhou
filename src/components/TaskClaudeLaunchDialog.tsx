import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { CwdSelector } from './CwdSelector'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Label } from './ui/label'
import { launchClaudeCode } from '../lib/claudeLogs'
import { getSettings } from '../lib/settings'

interface TaskClaudeLaunchDialogProps {
  taskText: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** セッション起動時に呼ばれるコールバック（セッションID、作業ディレクトリ） */
  onSessionLaunched?: (sessionId: string, cwd: string) => void
}

export function TaskClaudeLaunchDialog({
  taskText,
  open,
  onOpenChange,
  onSessionLaunched,
}: TaskClaudeLaunchDialogProps) {
  const [cwd, setCwd] = useState('')
  const [isLaunching, setIsLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultClaudeCwd, setDefaultClaudeCwd] = useState<string | undefined>(undefined)

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

  // ダイアログが開いた時に状態をリセット
  useEffect(() => {
    if (open) {
      setCwd('')
      setError(null)
    }
  }, [open])

  const handleLaunch = async () => {
    if (!cwd.trim()) return
    setError(null)
    setIsLaunching(true)

    try {
      // プロンプトとしてタスクテキストを渡す
      const sessionId = await launchClaudeCode(cwd.trim(), taskText)

      // セッション起動を通知
      onSessionLaunched?.(sessionId, cwd.trim())

      // ダイアログを閉じる
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Claude Codeの起動に失敗しました: ${message}`)
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>外部ターミナルでClaude Codeを起動</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>タスク</Label>
            <div className="p-2 bg-muted rounded text-sm">{taskText}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cwd">作業ディレクトリ</Label>
            <CwdSelector
              value={cwd}
              onChange={setCwd}
              defaultCwd={defaultClaudeCwd}
              disabled={isLaunching}
            />
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="flex gap-2">
            <Button
              onClick={handleLaunch}
              disabled={!cwd.trim() || isLaunching}
              className="flex-1"
            >
              {isLaunching ? '起動中...' : '外部ターミナルで起動'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLaunching}
            >
              キャンセル
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
