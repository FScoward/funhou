import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getSettings, setAlwaysOnTop, setFontFamily } from '@/lib/settings'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  db: Database
  onFontChange?: (fontFamily: string) => void
}

export function SettingsDialog({ open, onOpenChange, db, onFontChange }: SettingsDialogProps) {
  const [alwaysOnTop, setAlwaysOnTopState] = useState(false)
  const [fonts, setFonts] = useState<string[]>([])
  const [selectedFont, setSelectedFont] = useState<string>('')
  const [isLoadingFonts, setIsLoadingFonts] = useState(false)

  useEffect(() => {
    if (open) {
      loadSettings()
      loadFonts()
    }
  }, [open])

  const loadSettings = async () => {
    const settings = await getSettings(db)
    setAlwaysOnTopState(settings.alwaysOnTop)
    setSelectedFont(settings.fontFamily || 'default')
  }

  const loadFonts = async () => {
    try {
      setIsLoadingFonts(true)
      const systemFonts = await invoke<string[]>('get_system_fonts')
      setFonts(systemFonts)
    } catch (error) {
      console.error('フォントリストの取得に失敗しました:', error)
      setFonts([])
    } finally {
      setIsLoadingFonts(false)
    }
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

  const handleFontChange = async (fontFamily: string) => {
    try {
      setSelectedFont(fontFamily)

      // "default"の場合はデフォルトに戻す
      if (fontFamily === 'default') {
        await setFontFamily(db, '')
        if (onFontChange) {
          onFontChange('')
        }
        return
      }

      await setFontFamily(db, fontFamily)

      // 親コンポーネントに通知してフォントを適用
      if (onFontChange) {
        onFontChange(fontFamily)
      }
    } catch (error) {
      console.error('フォント設定の変更に失敗しました:', error)
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

          <div className="flex flex-col space-y-2">
            <Label htmlFor="font-family">フォント</Label>
            <Select
              value={selectedFont}
              onValueChange={handleFontChange}
              disabled={isLoadingFonts}
            >
              <SelectTrigger>
                <SelectValue placeholder="デフォルト" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">デフォルト</SelectItem>
                {fonts.map((font) => (
                  <SelectItem key={font} value={font}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFont && selectedFont !== 'default' && (
              <div
                className="mt-2 p-4 rounded-md border border-border bg-muted"
                style={{ fontFamily: selectedFont }}
              >
                <p className="text-sm">プレビュー: {selectedFont}</p>
                <p className="mt-2">ABCDEFGabcdefg 12345</p>
                <p>あいうえお漢字サンプル</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
