import Database from '@tauri-apps/plugin-sql'

export interface Settings {
  alwaysOnTop: boolean
}

export async function getSettings(db: Database): Promise<Settings> {
  try {
    const result = await db.select<Array<{ key: string; value: string }>>(
      'SELECT key, value FROM settings'
    )

    const settings: Settings = {
      alwaysOnTop: false,
    }

    result.forEach((row) => {
      if (row.key === 'always_on_top') {
        settings.alwaysOnTop = row.value === 'true'
      }
    })

    return settings
  } catch (error) {
    console.error('設定の読み込みに失敗しました:', error)
    return {
      alwaysOnTop: false,
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
