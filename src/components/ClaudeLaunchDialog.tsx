import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { useClaudeLogs } from '../hooks/useClaudeLogs'
import { CwdSelector } from './CwdSelector'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { getSettings } from '../lib/settings'

interface ClaudeLaunchDialogProps {
  initialPrompt?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ClaudeLaunchDialog({
  initialPrompt,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ClaudeLaunchDialogProps) {
  const { launch, loading, error } = useClaudeLogs()
  const [internalOpen, setInternalOpen] = useState(false)

  // 制御モードかどうかを判定
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled
    ? (v: boolean) => controlledOnOpenChange?.(v)
    : setInternalOpen
  const [cwd, setCwd] = useState('')
  const [prompt, setPrompt] = useState(initialPrompt || '')
  const [launched, setLaunched] = useState(false)
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

  const handleLaunch = async () => {
    if (!cwd.trim()) return

    await launch(cwd.trim(), prompt.trim() || undefined)
    setLaunched(true)
    setTimeout(() => {
      setOpen(false)
      setLaunched(false)
      setCwd('')
      setPrompt(initialPrompt || '')
    }, 1500)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      setPrompt(initialPrompt || '')
      setLaunched(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Claude Codeを起動</DialogTitle>
        </DialogHeader>

        {launched ? (
          <div className="py-8 text-center text-green-600">
            Claude Codeを起動しました
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cwd">作業ディレクトリ</Label>
              <CwdSelector
                value={cwd}
                onChange={setCwd}
                defaultCwd={defaultClaudeCwd}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">プロンプト（任意）</Label>
              <Input
                id="prompt"
                placeholder="タスクの指示を入力..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}
          </div>
        )}

        {!launched && (
          <DialogFooter>
            <Button
              onClick={handleLaunch}
              disabled={loading || !cwd.trim()}
            >
              {loading ? '起動中...' : '実行'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
