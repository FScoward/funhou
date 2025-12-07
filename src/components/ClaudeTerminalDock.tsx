import { useClaudeTerminalSession } from '../contexts/ClaudeTerminalSessionContext'
import { Terminal, X, ExternalLink, Loader2 } from 'lucide-react'
import { focusTerminalWindow } from '../lib/windowBridge'

/**
 * メインウィンドウ下部に表示されるドックUI
 * アクティブなClaude Codeセッションを表示し、別ウィンドウで開く
 */
export function ClaudeTerminalDock() {
  const {
    sessions,
    openInWindow,
    minimizeToDoc,
    isWindowOpen,
    terminateSession,
  } = useClaudeTerminalSession()

  // アクティブなセッション（stopped以外）を取得
  const activeSessions = Array.from(sessions.values()).filter(
    (session) => session.status !== 'stopped'
  )

  // 表示するセッションがない場合は何も表示しない
  if (activeSessions.length === 0) {
    return null
  }

  const handleSessionClick = async (sessionId: string) => {
    // まずTauriでウィンドウが存在するか確認してフォーカス
    const focused = await focusTerminalWindow(sessionId)
    if (!focused) {
      // ウィンドウが存在しない場合は開く
      await openInWindow(sessionId)
    }
  }

  const handleCloseSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    // まずウィンドウを閉じる
    if (isWindowOpen(sessionId)) {
      await minimizeToDoc(sessionId)
    }
    // セッションを終了
    await terminateSession(sessionId, true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'waiting_input':
        return 'bg-yellow-500'
      case 'asking_question':
        return 'bg-blue-500'
      case 'initializing':
        return 'bg-gray-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'initializing') {
      return <Loader2 className="w-3 h-3 animate-spin" />
    }
    return null
  }

  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 shadow-lg">
        {activeSessions.map((session) => {
          const windowOpen = isWindowOpen(session.id)
          console.log('[Dock] session:', session.id, 'name:', session.name, 'cwd:', session.cwd)
          const title = session.name || `Session ${session.id.slice(0, 6)}`

          return (
            <div
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              className={`
                group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer
                transition-all duration-200
                ${windowOpen
                  ? 'bg-white/20 ring-1 ring-white/30'
                  : 'bg-white/10 hover:bg-white/15'
                }
              `}
              title={`${title} - ${session.status}${windowOpen ? ' (opened)' : ''}`}
            >
              {/* ステータスインジケーター */}
              <div className="relative">
                <Terminal className="w-4 h-4 text-white/80" />
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${getStatusColor(session.status)} ring-1 ring-black/50`}
                />
              </div>

              {/* セッション名 */}
              <span className="text-xs text-white/90 font-medium max-w-[100px] truncate">
                {title}
              </span>

              {/* ステータスアイコン（初期化中のみ） */}
              {getStatusIcon(session.status)}

              {/* 外部ウィンドウアイコン（開いている場合） */}
              {windowOpen && (
                <ExternalLink className="w-3 h-3 text-white/60" />
              )}

              {/* 閉じるボタン */}
              <button
                onClick={(e) => handleCloseSession(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/20 rounded transition-opacity"
                title="Close session"
              >
                <X className="w-3 h-3 text-white/70" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
