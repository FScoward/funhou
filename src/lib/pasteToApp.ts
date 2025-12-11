import { invoke } from '@tauri-apps/api/core'

export interface PasteResult {
  success: boolean
  error?: string
}

export interface AppInfo {
  name: string
  bundle_id?: string
}

/**
 * 実行中のアプリ一覧を取得（funhou以外）
 * @returns アプリ一覧
 */
export async function getRunningApps(): Promise<AppInfo[]> {
  console.log('[pasteToApp] Getting running apps...')
  try {
    const apps = await invoke<AppInfo[]>('get_running_apps')
    console.log('[pasteToApp] Running apps:', apps)
    return apps
  } catch (error) {
    console.error('[pasteToApp] Error getting apps:', error)
    throw error
  }
}

/**
 * 指定したアプリにテキストをペースト
 * @param text 送信するテキスト
 * @param targetApp 送信先アプリ名
 * @returns 送信結果
 */
export async function pasteTextToApp(text: string, targetApp: string): Promise<PasteResult> {
  console.log('[pasteToApp] Invoking paste_text_to_app with text:', text.substring(0, 50), 'target:', targetApp)
  try {
    const result = await invoke<PasteResult>('paste_text_to_app', { text, targetApp })
    console.log('[pasteToApp] Result:', result)
    return result
  } catch (error) {
    console.error('[pasteToApp] Error:', error)
    throw error
  }
}
