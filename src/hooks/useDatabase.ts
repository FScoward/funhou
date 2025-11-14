import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { getDb } from '@/lib/database'
import { getSettings } from '@/lib/settings'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function useDatabase() {
  const [database, setDatabase] = useState<Database | null>(null)

  useEffect(() => {
    initializeDb()
  }, [])

  const initializeDb = async () => {
    const db = await getDb()
    setDatabase(db)

    // 設定を読み込んでウィンドウに適用
    try {
      const settings = await getSettings(db)
      const window = getCurrentWindow()
      await window.setAlwaysOnTop(settings.alwaysOnTop)
    } catch (error) {
      console.error('設定の適用に失敗しました:', error)
    }
  }

  return database
}
