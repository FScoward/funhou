import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

/**
 * ウィンドウ間で同期するセッションデータのペイロード
 */
export interface SessionSyncPayload {
  sessionId: string
  type: 'output' | 'input' | 'status' | 'resize' | 'terminate'
  data: unknown
}

/**
 * ウィンドウの状態
 */
export interface WindowState {
  isOpen: boolean
  isMinimized: boolean
  title: string
}

// イベント名のプレフィックス
const EVENT_PREFIX = 'claude-terminal'

/**
 * セッションIDに対応するイベント名を生成
 */
function getEventName(sessionId: string, direction: 'to-window' | 'from-window'): string {
  return `${EVENT_PREFIX}:${direction}:${sessionId}`
}

/**
 * メインウィンドウから別ウィンドウへデータを送信
 */
export async function sendToTerminalWindow(
  sessionId: string,
  payload: Omit<SessionSyncPayload, 'sessionId'>
): Promise<void> {
  await emit(getEventName(sessionId, 'to-window'), {
    sessionId,
    ...payload,
  })
}

/**
 * 別ウィンドウからメインウィンドウへデータを送信
 */
export async function sendToMainWindow(
  sessionId: string,
  payload: Omit<SessionSyncPayload, 'sessionId'>
): Promise<void> {
  await emit(getEventName(sessionId, 'from-window'), {
    sessionId,
    ...payload,
  })
}

/**
 * メインウィンドウで別ウィンドウからのデータを受信
 */
export async function listenFromTerminalWindow(
  sessionId: string,
  callback: (payload: SessionSyncPayload) => void
): Promise<UnlistenFn> {
  return listen<SessionSyncPayload>(getEventName(sessionId, 'from-window'), (event) => {
    callback(event.payload)
  })
}

/**
 * 別ウィンドウでメインウィンドウからのデータを受信
 */
export async function listenFromMainWindow(
  sessionId: string,
  callback: (payload: SessionSyncPayload) => void
): Promise<UnlistenFn> {
  return listen<SessionSyncPayload>(getEventName(sessionId, 'to-window'), (event) => {
    callback(event.payload)
  })
}

/**
 * Claude Codeターミナルウィンドウを作成
 */
export async function createTerminalWindow(
  sessionId: string,
  title: string
): Promise<void> {
  await invoke('create_claude_terminal_window', { sessionId, title })
}

/**
 * Claude Codeターミナルウィンドウを閉じる
 */
export async function closeTerminalWindow(sessionId: string): Promise<void> {
  await invoke('close_claude_terminal_window', { sessionId })
}

/**
 * Claude Codeターミナルウィンドウにフォーカス
 * @returns ウィンドウが存在した場合true
 */
export async function focusTerminalWindow(sessionId: string): Promise<boolean> {
  return invoke<boolean>('focus_claude_terminal_window', { sessionId })
}

/**
 * ウィンドウのクローズイベントを監視
 */
export async function listenWindowClosed(
  sessionId: string,
  callback: () => void
): Promise<UnlistenFn> {
  const windowLabel = `claude-terminal-${sessionId}`
  return listen(`tauri://close-requested`, (event) => {
    // Tauri 2.x ではウィンドウラベルでフィルタリング
    if ((event as { windowLabel?: string }).windowLabel === windowLabel) {
      callback()
    }
  })
}
