import Database from '@tauri-apps/plugin-sql'

export type ScreenEdge = 'left' | 'right'

export interface Settings {
  alwaysOnTop: boolean
  fontFamily?: string
  fontSize?: string
  autohideEnabled?: boolean
  autohideEdge?: ScreenEdge
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
