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
  setOllamaEnabled,
  setOllamaModel,
} from '@/lib/settings'
import { checkOllamaAvailable, getAvailableModels } from '@/lib/ollama'
import { ThemeVariant } from '@/lib/themes'

interface SettingsSidebarProps {
  isOpen: boolean
  onToggle: () => void
  db: Database | null
  onFontChange?: (fontFamily: string) => void
  onFontSizeChange?: (fontSize: string) => void
  onThemeChange?: (theme: ThemeVariant) => void
  onOllamaEnabledChange?: (enabled: boolean) => void
  onOllamaModelChange?: (model: string) => void
}

export function SettingsSidebar({
  isOpen,
  onToggle,
  db,
  onFontChange,
  onFontSizeChange,
  onThemeChange,
  onOllamaEnabledChange,
  onOllamaModelChange,
}: SettingsSidebarProps) {
  const [alwaysOnTop, setAlwaysOnTopState] = useState(false)
  const [fonts, setFonts] = useState<string[]>([])
  const [selectedFont, setSelectedFont] = useState<string>('')
  const [selectedFontSize, setSelectedFontSize] = useState<string>('default')
  const [selectedTheme, setSelectedTheme] = useState<ThemeVariant>('default')
  const [isLoadingFonts, setIsLoadingFonts] = useState(false)
  const [tabShimmerEnabled, setTabShimmerEnabledState] = useState(true)
  const [ollamaEnabled, setOllamaEnabledState] = useState(false)
  const [ollamaModel, setOllamaModelState] = useState<string>('gemma3:4b')
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [isCheckingOllama, setIsCheckingOllama] = useState(false)

  useEffect(() => {
    if (isOpen && db) {
      loadSettings()
      loadFonts()
      checkOllamaStatus()
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
    setOllamaEnabledState(settings.ollamaEnabled ?? false)
    setOllamaModelState(settings.ollamaModel || 'gemma3:4b')
  }

  const checkOllamaStatus = async () => {
    setIsCheckingOllama(true)
    try {
      const available = await checkOllamaAvailable()
      setOllamaAvailable(available)
      if (available) {
        const models = await getAvailableModels()
        setOllamaModels(models)
      }
    } catch (error) {
      console.error('Ollamaの状態確認に失敗しました:', error)
      setOllamaAvailable(false)
    } finally {
      setIsCheckingOllama(false)
    }
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

  const handleOllamaEnabledChange = async (checked: boolean) => {
    if (!db) return
    try {
      setOllamaEnabledState(checked)
      await setOllamaEnabled(db, checked)
      if (onOllamaEnabledChange) onOllamaEnabledChange(checked)
    } catch (error) {
      console.error('Ollama設定の変更に失敗しました:', error)
      setOllamaEnabledState(!checked)
    }
  }

  const handleOllamaModelChange = async (model: string) => {
    if (!db) return
    try {
      setOllamaModelState(model)
      await setOllamaModel(db, model)
      if (onOllamaModelChange) onOllamaModelChange(model)
    } catch (error) {
      console.error('Ollamaモデル設定の変更に失敗しました:', error)
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

          {/* Ollama テキスト整形（区切り線） */}
          <div className="settings-section-divider" />

          {/* Ollama テキスト整形 */}
          <div className="settings-item">
            <div className="settings-item-label">
              <Label htmlFor="ollama-enabled">音声入力のテキスト整形</Label>
              <span className="settings-item-description">
                Ollamaを使用して音声認識結果に句読点を追加
                {isCheckingOllama && ' (確認中...)'}
                {ollamaAvailable === false && (
                  <span className="text-destructive"> (Ollamaサーバー未起動)</span>
                )}
                {ollamaAvailable === true && (
                  <span className="text-green-600 dark:text-green-400"> (接続済み)</span>
                )}
              </span>
            </div>
            <Switch
              id="ollama-enabled"
              checked={ollamaEnabled}
              onCheckedChange={handleOllamaEnabledChange}
              disabled={ollamaAvailable === false}
            />
          </div>

          {/* Ollamaモデル選択 */}
          {ollamaEnabled && ollamaAvailable && (
            <div className="settings-item-vertical">
              <Label htmlFor="ollama-model">Ollamaモデル</Label>
              <Select
                value={ollamaModel}
                onValueChange={handleOllamaModelChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="モデルを選択" />
                </SelectTrigger>
                <SelectContent>
                  {ollamaModels.length > 0 ? (
                    ollamaModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="gemma3:4b">gemma3:4b</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground mt-1">
                推奨: gemma3:4b（日本語対応・軽量）
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
