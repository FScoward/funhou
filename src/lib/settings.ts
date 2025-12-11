import Database from '@tauri-apps/plugin-sql'
import { ThemeVariant } from './themes'

export type ScreenEdge = 'left' | 'right'

export interface Settings {
  alwaysOnTop: boolean
  fontFamily?: string
  fontSize?: string
  autohideEnabled?: boolean
  autohideEdge?: ScreenEdge
  tabShimmerEnabled?: boolean
  theme?: ThemeVariant
  ollamaEnabled?: boolean
  ollamaModel?: string
  defaultClaudeCwd?: string
  taskAutoTagName?: string
}

export async function getSettings(db: Database): Promise<Settings> {
  try {
    const result = await db.select<Array<{ key: string; value: string }>>(
      'SELECT key, value FROM settings'
    )

    const settings: Settings = {
      alwaysOnTop: false,
      fontFamily: undefined,
      fontSize: undefined,
      autohideEnabled: false,
      autohideEdge: 'left',
      tabShimmerEnabled: true,
      theme: 'default',
      ollamaEnabled: false,
      ollamaModel: 'gemma3:4b',
      defaultClaudeCwd: undefined,
      taskAutoTagName: 'TASK',
    }

    result.forEach((row) => {
      if (row.key === 'always_on_top') {
        settings.alwaysOnTop = row.value === 'true'
      } else if (row.key === 'font_family') {
        settings.fontFamily = row.value
      } else if (row.key === 'font_size') {
        settings.fontSize = row.value
      } else if (row.key === 'autohide_enabled') {
        settings.autohideEnabled = row.value === 'true'
      } else if (row.key === 'autohide_edge') {
        settings.autohideEdge = row.value as ScreenEdge
      } else if (row.key === 'tab_shimmer_enabled') {
        settings.tabShimmerEnabled = row.value === 'true'
      } else if (row.key === 'theme') {
        settings.theme = row.value as ThemeVariant
      } else if (row.key === 'ollama_enabled') {
        settings.ollamaEnabled = row.value === 'true'
      } else if (row.key === 'ollama_model') {
        settings.ollamaModel = row.value
      } else if (row.key === 'default_claude_cwd') {
        settings.defaultClaudeCwd = row.value
      } else if (row.key === 'task_auto_tag_name') {
        settings.taskAutoTagName = row.value
      }
    })

    return settings
  } catch (error) {
    console.error('設定の読み込みに失敗しました:', error)
    return {
      alwaysOnTop: false,
      fontFamily: undefined,
      fontSize: undefined,
      autohideEnabled: false,
      autohideEdge: 'left',
      tabShimmerEnabled: true,
      theme: 'default',
      ollamaEnabled: false,
      ollamaModel: 'gemma3:4b',
      defaultClaudeCwd: undefined,
      taskAutoTagName: 'TASK',
    }
  }
}

export async function saveSetting(
  db: Database,
  key: string,
  value: string
): Promise<void> {
  try {
    await db.execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    )
  } catch (error) {
    console.error('設定の保存に失敗しました:', error)
    throw error
  }
}

export async function setAlwaysOnTop(
  db: Database,
  value: boolean
): Promise<void> {
  await saveSetting(db, 'always_on_top', value ? 'true' : 'false')
}

export async function setFontFamily(
  db: Database,
  value: string
): Promise<void> {
  await saveSetting(db, 'font_family', value)
}

export async function setFontSize(
  db: Database,
  value: string
): Promise<void> {
  await saveSetting(db, 'font_size', value)
}

export async function setAutohideEnabled(
  db: Database,
  value: boolean
): Promise<void> {
  await saveSetting(db, 'autohide_enabled', value ? 'true' : 'false')
}

export async function setAutohideEdge(
  db: Database,
  value: ScreenEdge
): Promise<void> {
  await saveSetting(db, 'autohide_edge', value)
}

export async function setTabShimmerEnabled(
  db: Database,
  value: boolean
): Promise<void> {
  await saveSetting(db, 'tab_shimmer_enabled', value ? 'true' : 'false')
  // localStorageにも保存してtabウィンドウと共有
  localStorage.setItem('tab_shimmer_enabled', value ? 'true' : 'false')
}

export async function setTheme(
  db: Database,
  value: ThemeVariant
): Promise<void> {
  await saveSetting(db, 'theme', value)
}

export function applyFont(fontFamily: string): void {
  if (fontFamily) {
    document.documentElement.style.setProperty('--font-family', fontFamily)
  } else {
    document.documentElement.style.removeProperty('--font-family')
  }
}

export function applyFontSize(fontSize: string): void {
  if (fontSize) {
    document.documentElement.style.setProperty('--font-size', fontSize)
  } else {
    document.documentElement.style.removeProperty('--font-size')
  }
}

export async function setOllamaEnabled(
  db: Database,
  value: boolean
): Promise<void> {
  await saveSetting(db, 'ollama_enabled', value ? 'true' : 'false')
}

export async function setOllamaModel(
  db: Database,
  value: string
): Promise<void> {
  await saveSetting(db, 'ollama_model', value)
}

export async function setDefaultClaudeCwd(
  db: Database,
  value: string
): Promise<void> {
  await saveSetting(db, 'default_claude_cwd', value)
}

export async function setTaskAutoTagName(
  db: Database,
  value: string
): Promise<void> {
  await saveSetting(db, 'task_auto_tag_name', value)
}
