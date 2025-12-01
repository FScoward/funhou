import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { Settings, ChevronRight } from 'lucide-react'
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
  setTheme,
} from '@/lib/settings'
import { ThemeVariant } from '@/lib/themes'

interface SettingsSidebarProps {
  isOpen: boolean
  onToggle: () => void
  db: Database | null
  onFontChange?: (fontFamily: string) => void
  onFontSizeChange?: (fontSize: string) => void
  onThemeChange?: (theme: ThemeVariant) => void
}

export function SettingsSidebar({
  isOpen,
  onToggle,
  db,
  onFontChange,
  onFontSizeChange,
  onThemeChange
}: SettingsSidebarProps) {
  const [alwaysOnTop, setAlwaysOnTopState] = useState(false)
  const [fonts, setFonts] = useState<string[]>([])
  const [selectedFont, setSelectedFont] = useState<string>('')
  const [selectedFontSize, setSelectedFontSize] = useState<string>('default')
  const [selectedTheme, setSelectedTheme] = useState<ThemeVariant>('default')
  const [isLoadingFonts, setIsLoadingFonts] = useState(false)
  const [tabShimmerEnabled, setTabShimmerEnabledState] = useState(true)

  useEffect(() => {
    if (isOpen && db) {
      loadSettings()
      loadFonts()
    }
  }, [isOpen, db])

  const loadSettings = async () => {
    if (!db) return
    const settings = await getSettings(db)
    setAlwaysOnTopState(settings.alwaysOnTop)
    setSelectedFont(settings.fontFamily || 'default')
    setSelectedFontSize(settings.fontSize || 'default')
    setSelectedTheme(settings.theme || 'default')
    setTabShimmerEnabledState(settings.tabShimmerEnabled ?? true)
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
    if (!db) return
    try {
      setAlwaysOnTopState(checked)
      await setAlwaysOnTop(db, checked)
      const window = getCurrentWindow()
      await window.setAlwaysOnTop(checked)
    } catch (error) {
      console.error('設定の変更に失敗しました:', error)
      setAlwaysOnTopState(!checked)
    }
  }

  const handleFontChange = async (fontFamily: string) => {
    if (!db) return
    try {
      setSelectedFont(fontFamily)
      if (fontFamily === 'default') {
        await setFontFamily(db, '')
        if (onFontChange) onFontChange('')
        return
      }
      await setFontFamily(db, fontFamily)
      if (onFontChange) onFontChange(fontFamily)
    } catch (error) {
      console.error('フォント設定の変更に失敗しました:', error)
    }
  }

  const handleFontSizeChange = async (fontSize: string) => {
    if (!db) return
    try {
      setSelectedFontSize(fontSize)
      if (fontSize === 'default') {
        await setFontSize(db, '')
        if (onFontSizeChange) onFontSizeChange('')
        return
      }
      await setFontSize(db, fontSize)
      if (onFontSizeChange) onFontSizeChange(fontSize)
    } catch (error) {
      console.error('フォントサイズ設定の変更に失敗しました:', error)
    }
  }

  const handleResetFont = async () => {
    if (!db) return
    try {
      setSelectedFont('default')
      setSelectedFontSize('default')
      await setFontFamily(db, '')
      await setFontSize(db, '')
      if (onFontChange) onFontChange('')
      if (onFontSizeChange) onFontSizeChange('')
    } catch (error) {
      console.error('フォント設定のリセットに失敗しました:', error)
    }
  }

  const handleTabShimmerChange = async (checked: boolean) => {
    if (!db) return
    try {
      setTabShimmerEnabledState(checked)
      await setTabShimmerEnabled(db, checked)
    } catch (error) {
      console.error('設定の変更に失敗しました:', error)
      setTabShimmerEnabledState(!checked)
    }
  }

  const handleThemeChange = async (theme: ThemeVariant) => {
    if (!db) return
    try {
      setSelectedTheme(theme)
      await setTheme(db, theme)
      if (onThemeChange) onThemeChange(theme)
    } catch (error) {
      console.error('テーマ設定の変更に失敗しました:', error)
    }
  }

  return (
    <>
      {/* トグルボタン（常に表示） */}
      {!isOpen && (
        <button
          className="settings-sidebar-toggle-fab"
          onClick={onToggle}
          aria-label="設定を開く"
        >
          <Settings size={14} />
        </button>
      )}

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="sidebar-overlay settings-overlay"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* Drawerサイドバー */}
      <aside className={`settings-sidebar-drawer ${isOpen ? 'open' : 'closed'}`}>
        <button
          className="sidebar-close"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        >
          <ChevronRight size={16} />
        </button>

        <div className="settings-sidebar-header">
          <Settings size={18} />
          <h2>設定</h2>
        </div>

        <div className="settings-sidebar-content">
          {/* 常に最前面表示 */}
          <div className="settings-item">
            <div className="settings-item-label">
              <Label htmlFor="always-on-top">常に最前面表示</Label>
              <span className="settings-item-description">
                ウィンドウを常に他のウィンドウの前面に表示します
              </span>
            </div>
            <Switch
              id="always-on-top"
              checked={alwaysOnTop}
              onCheckedChange={handleAlwaysOnTopChange}
            />
          </div>

          {/* タブのキラキラ効果 */}
          <div className="settings-item">
            <div className="settings-item-label">
              <Label htmlFor="tab-shimmer">タブのキラキラ効果</Label>
              <span className="settings-item-description">
                サイドタブに光るアニメーション効果を表示します
              </span>
            </div>
            <Switch
              id="tab-shimmer"
              checked={tabShimmerEnabled}
              onCheckedChange={handleTabShimmerChange}
            />
          </div>

          {/* テーマ */}
          <div className="settings-item-vertical">
            <Label htmlFor="theme">テーマ</Label>
            <Select
              value={selectedTheme}
              onValueChange={(value) => handleThemeChange(value as ThemeVariant)}
            >
              <SelectTrigger>
                <SelectValue placeholder="デフォルト" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">デフォルト</SelectItem>
                <SelectItem value="rose-pine">Rose Pine</SelectItem>
                <SelectItem value="rose-pine-moon">Rose Pine Moon</SelectItem>
                <SelectItem value="rose-pine-dawn">Rose Pine Dawn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* フォント */}
          <div className="settings-item-vertical">
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

          {/* フォントサイズ */}
          <div className="settings-item-vertical">
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

          {/* フォントプレビュー */}
          {(selectedFont !== 'default' || selectedFontSize !== 'default') && (
            <div className="settings-font-preview">
              <div
                className="settings-font-preview-box"
                style={{
                  fontFamily: selectedFont !== 'default' ? selectedFont : undefined,
                  fontSize: selectedFontSize !== 'default' ? selectedFontSize : undefined,
                }}
              >
                <p className="preview-label">プレビュー</p>
                <p>ABCDEFGabcdefg 12345</p>
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
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
