import { useState, useCallback } from 'react'
import { pasteTextToApp, getRunningApps, type PasteResult, type AppInfo } from '@/lib/pasteToApp'

const STORAGE_KEY = 'pasteToApp.targetApp'
const STORAGE_KEY_BUNDLE_ID = 'pasteToApp.bundleId'

export function usePasteToApp() {
  const [isPasting, setIsPasting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<PasteResult | null>(null)
  const [runningApps, setRunningApps] = useState<AppInfo[]>([])
  const [targetApp, setTargetApp] = useState<string | null>(() => {
    // localStorageから復元
    return localStorage.getItem(STORAGE_KEY)
  })
  const [targetBundleId, setTargetBundleId] = useState<string | null>(() => {
    // localStorageから復元
    return localStorage.getItem(STORAGE_KEY_BUNDLE_ID)
  })
  const [isLoadingApps, setIsLoadingApps] = useState(false)

  // アプリ一覧を取得
  const refreshApps = useCallback(async () => {
    setIsLoadingApps(true)
    try {
      const apps = await getRunningApps()
      setRunningApps(apps)
      return apps
    } catch (e) {
      console.error('Failed to get running apps:', e)
      return []
    } finally {
      setIsLoadingApps(false)
    }
  }, [])

  // 送信先アプリを設定
  const selectTargetApp = useCallback((appInfo: AppInfo | null) => {
    if (appInfo) {
      setTargetApp(appInfo.name)
      setTargetBundleId(appInfo.bundle_id ?? null)
      localStorage.setItem(STORAGE_KEY, appInfo.name)
      if (appInfo.bundle_id) {
        localStorage.setItem(STORAGE_KEY_BUNDLE_ID, appInfo.bundle_id)
      } else {
        localStorage.removeItem(STORAGE_KEY_BUNDLE_ID)
      }
    } else {
      setTargetApp(null)
      setTargetBundleId(null)
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_KEY_BUNDLE_ID)
    }
  }, [])

  // ペースト実行
  const paste = useCallback(async (text: string): Promise<boolean> => {
    if (!text.trim()) {
      return false
    }

    if (!targetApp) {
      setError('送信先アプリが選択されていません')
      return false
    }

    setIsPasting(true)
    setError(null)

    try {
      const result = await pasteTextToApp(text, targetApp, targetBundleId ?? undefined)
      setLastResult(result)

      if (!result.success) {
        setError(result.error ?? 'Unknown error')
        return false
      }

      return true
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      setError(errorMessage)
      setLastResult({ success: false, error: errorMessage })
      return false
    } finally {
      setIsPasting(false)
    }
  }, [targetApp, targetBundleId])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    paste,
    isPasting,
    error,
    lastResult,
    clearError,
    // 新しいプロパティ
    runningApps,
    targetApp,
    selectTargetApp,
    refreshApps,
    isLoadingApps,
  }
}
