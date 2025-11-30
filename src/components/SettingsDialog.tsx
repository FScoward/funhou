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
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getSettings,
  setAlwaysOnTop,
  setFontFamily,
  setFontSize,
  setTabShimmerEnabled,
} from '@/lib/settings'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  db: Database
  onFontChange?: (fontFamily: string) => void
  onFontSizeChange?: (fontSize: string) => void
}

export function SettingsDialog({ open, onOpenChange, db, onFontChange, onFontSizeChange }: SettingsDialogProps) {
  const [alwaysOnTop, setAlwaysOnTopState] = useState(false)
  const [fonts, setFonts] = useState<string[]>([])
  const [selectedFont, setSelectedFont] = useState<string>('')
  const [selectedFontSize, setSelectedFontSize] = useState<string>('default')
  const [isLoadingFonts, setIsLoadingFonts] = useState(false)
  const [tabShimmerEnabled, setTabShimmerEnabledState] = useState(true)

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
    setSelectedFontSize(settings.fontSize || 'default')
    setTabShimmerEnabledState(settings.tabShimmerEnabled ?? true)
    // localStorageも初期化
    localStorage.setItem('tab_shimmer_enabled', (settings.tabShimmerEnabled ?? true) ? 'true' : 'false')
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

  const handleFontSizeChange = async (fontSize: string) => {
    try {
      setSelectedFontSize(fontSize)

      // "default"の場合はデフォルトに戻す
      if (fontSize === 'default') {
        await setFontSize(db, '')
        if (onFontSizeChange) {
          onFontSizeChange('')
        }
        return
      }

      await setFontSize(db, fontSize)

      // 親コンポーネントに通知してフォントサイズを適用
      if (onFontSizeChange) {
        onFontSizeChange(fontSize)
      }
    } catch (error) {
      console.error('フォントサイズ設定の変更に失敗しました:', error)
    }
  }

  const handleResetFont = async () => {
    try {
      // フォントとフォントサイズを両方デフォルトに戻す
      setSelectedFont('default')
      setSelectedFontSize('default')

      await setFontFamily(db, '')
      await setFontSize(db, '')

      if (onFontChange) {
        onFontChange('')
      }
      if (onFontSizeChange) {
        onFontSizeChange('')
      }
    } catch (error) {
      console.error('フォント設定のリセットに失敗しました:', error)
    }
  }

  const handleTabShimmerChange = async (checked: boolean) => {
    try {
      setTabShimmerEnabledState(checked)
      await setTabShimmerEnabled(db, checked)
    } catch (error) {
      console.error('設定の変更に失敗しました:', error)
      setTabShimmerEnabledState(!checked)
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

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="tab-shimmer" className="flex flex-col space-y-1">
              <span>タブのキラキラ効果</span>
              <span className="font-normal text-sm text-muted-foreground">
                サイドタブに光るアニメーション効果を表示します
              </span>
            </Label>
            <Switch
              id="tab-shimmer"
              checked={tabShimmerEnabled}
              onCheckedChange={handleTabShimmerChange}
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
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="font-size">フォントサイズ</Label>
            <Select
              value={selectedFontSize}
              onValueChange={handleFontSizeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="デフォルト" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">デフォルト</SelectItem>
                <SelectItem value="8pt">8pt</SelectItem>
                <SelectItem value="9pt">9pt</SelectItem>
                <SelectItem value="10pt">10pt</SelectItem>
                <SelectItem value="11pt">11pt</SelectItem>
                <SelectItem value="12pt">12pt</SelectItem>
                <SelectItem value="14pt">14pt</SelectItem>
                <SelectItem value="16pt">16pt</SelectItem>
                <SelectItem value="18pt">18pt</SelectItem>
                <SelectItem value="20pt">20pt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(selectedFont !== 'default' || selectedFontSize !== 'default') && (
            <>
              <div
                className="mt-2 p-4 rounded-2xl border border-border bg-muted"
                style={{
                  fontFamily: selectedFont !== 'default' ? selectedFont : undefined,
                  fontSize: selectedFontSize !== 'default' ? selectedFontSize : undefined,
                }}
              >
                <p className="text-sm mb-2">プレビュー</p>
                <p className="mt-2">ABCDEFGabcdefg 12345</p>
                <p>あいうえお漢字サンプル</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFont}
                className="w-full"
              >
                フォント設定をリセット
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
