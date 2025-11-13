import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { getSettings, setAlwaysOnTop } from '@/lib/settings'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  db: Database
}

export function SettingsDialog({ open, onOpenChange, db }: SettingsDialogProps) {
  const [alwaysOnTop, setAlwaysOnTopState] = useState(false)

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    const settings = await getSettings(db)
    setAlwaysOnTopState(settings.alwaysOnTop)
  }

  const handleAlwaysOnTopChange = async (checked: boolean) => {
    try {
      setAlwaysOnTopState(checked)
      await setAlwaysOnTop(db, checked)

      // ウィンドウの最前面表示設定を変更
      const window = getCurrentWindow()
      await window.setAlwaysOnTop(checked)
    } catch (error) {
      console.error('設定の変更に失敗しました:', error)
      // エラーが発生した場合は元の状態に戻す
      setAlwaysOnTopState(!checked)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>
            アプリケーションの設定を変更できます
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="always-on-top" className="flex flex-col space-y-1">
              <span>常に最前面表示</span>
              <span className="font-normal text-sm text-muted-foreground">
                ウィンドウを常に他のウィンドウの前面に表示します
              </span>
            </Label>
            <Switch
              id="always-on-top"
              checked={alwaysOnTop}
              onCheckedChange={handleAlwaysOnTopChange}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
