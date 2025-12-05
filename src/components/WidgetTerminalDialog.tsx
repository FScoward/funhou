import { useClaudeTerminalSession } from '../contexts/ClaudeTerminalSessionContext'
import { ClaudeTerminalDialog } from './ClaudeTerminalDialog'

/**
 * ウィジェットから開かれるターミナルダイアログ
 * Context の isDialogOpen を監視して開閉する
 */
export function WidgetTerminalDialog() {
  const { isDialogOpen, setDialogOpen, activeSessionId, getSession } = useClaudeTerminalSession()

  // アクティブセッションの情報を取得
  const activeSession = activeSessionId ? getSession(activeSessionId) : null

  // アクティブセッションがない場合は何も表示しない
  if (!activeSession) {
    return null
  }

  return (
    <ClaudeTerminalDialog
      open={isDialogOpen}
      onOpenChange={setDialogOpen}
      linkedCwd={activeSession.cwd}
      linkedSessionId={activeSession.claudeSessionId ?? null}
    />
  )
}
