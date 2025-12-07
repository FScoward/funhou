import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { CwdSelector } from './CwdSelector'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Terminal, ExternalLink } from 'lucide-react'
import { getSettings } from '../lib/settings'

export type LaunchType = 'app' | 'external'

interface CwdSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLaunch: (cwd: string, launchType: LaunchType) => void
  /** 外部ターミナル起動を許可するか */
  allowExternal?: boolean
  /** ダイアログタイトル */
  title?: string
}

export function CwdSelectorDialog({
  open,
  onOpenChange,
  onLaunch,
  allowExternal = true,
  title = '作業ディレクトリを選択',
}: CwdSelectorDialogProps) {
  const [cwd, setCwd] = useState('')
  const [defaultClaudeCwd, setDefaultClaudeCwd] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)

  // デフォルトcwd設定を読み込み
  useEffect(() => {
    if (!open) return

    async function loadDefaultCwd() {
      setIsLoading(true)
      try {
        const db = await Database.load('sqlite:funhou.db')
        const settings = await getSettings(db)
        if (settings.defaultClaudeCwd) {
          setDefaultClaudeCwd(settings.defaultClaudeCwd)
          // デフォルト値を設定
          if (!cwd) {
            setCwd(settings.defaultClaudeCwd)
          }
        }
      } catch (error) {
        console.error('デフォルトcwd設定の読み込みに失敗しました:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadDefaultCwd()
  }, [open])

  // ダイアログを閉じる時にリセット
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setCwd('')
    }
    onOpenChange(newOpen)
  }

  const handleLaunchApp = () => {
    if (!cwd.trim()) return
    onLaunch(cwd.trim(), 'app')
    handleOpenChange(false)
  }

  const handleLaunchExternal = () => {
    if (!cwd.trim()) return
    onLaunch(cwd.trim(), 'external')
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <CwdSelector
              value={cwd}
              onChange={setCwd}
              defaultCwd={defaultClaudeCwd}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            キャンセル
          </Button>
          {allowExternal && (
            <Button
              variant="outline"
              onClick={handleLaunchExternal}
              disabled={!cwd.trim() || isLoading}
            >
              <ExternalLink size={14} className="mr-1" />
              外部ターミナル
            </Button>
          )}
          <Button
            onClick={handleLaunchApp}
            disabled={!cwd.trim() || isLoading}
          >
            <Terminal size={14} className="mr-1" />
            アプリ内ターミナル
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
