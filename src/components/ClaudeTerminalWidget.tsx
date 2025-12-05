import { useState, useCallback } from 'react'
import { ChevronRight, Terminal, ChevronDown, ChevronUp, Maximize2, X } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useClaudeTerminalSession, type SessionStatus, type TerminalSession } from '../contexts/ClaudeTerminalSessionContext'

const STATUS_COLORS: Record<SessionStatus, string> = {
  initializing: 'bg-yellow-500',
  running: 'bg-green-500',
  waiting_input: 'bg-gray-500',
  asking_question: 'bg-orange-500',
  stopped: 'bg-gray-500',
  error: 'bg-red-500',
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  initializing: '初期化中...',
  running: '実行中',
  waiting_input: '完了',
  asking_question: '🔔 選択肢待ち',
  stopped: '終了',
  error: 'エラー',
}

interface ClaudeTerminalWidgetProps {
  isOpen: boolean
  onToggle: () => void
}

// cwdを短縮表示
function shortenCwd(cwd: string): string {
  const parts = cwd.split('/')
  if (parts.length > 2) {
    return '~/' + parts.slice(-2).join('/')
  }
  return cwd
}

// セッションカードコンポーネント
interface SessionCardProps {
  session: TerminalSession
  isExpanded: boolean
  onToggleExpand: () => void
  onOpenFullScreen: () => void
  onTerminate: () => void
  onSendInput: (input: string) => void
}

function SessionCard({
  session,
  isExpanded,
  onToggleExpand,
  onOpenFullScreen,
  onTerminate,
  onSendInput,
}: SessionCardProps) {
  const [inputValue, setInputValue] = useState('')

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSendInput(inputValue)
      setInputValue('')
    }
  }, [inputValue, onSendInput])

  const status = session.status
  const statusColor = STATUS_COLORS[status]
  const statusLabel = STATUS_LABELS[status]
  const isActive = status === 'running' || status === 'initializing' || status === 'asking_question'

  return (
    <div className="claude-terminal-session-card">
      {/* セッションヘッダー */}
      <button
        className="claude-terminal-session-header"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor} ${isActive ? 'animate-pulse' : ''}`} />
          <span className="truncate text-sm font-medium">{shortenCwd(session.cwd)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* 展開時のコンテンツ */}
      {isExpanded && (
        <div className="claude-terminal-session-content">
          {/* 入力フィールド */}
          <div className="claude-terminal-session-input">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="入力..."
              className="flex-1 h-8 text-sm"
            />
            <Button size="sm" onClick={handleSend} className="h-8">
              送信
            </Button>
          </div>

          {/* アクションボタン */}
          <div className="claude-terminal-session-actions">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={onOpenFullScreen}
            >
              <Maximize2 size={12} className="mr-1" />
              全画面
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={onTerminate}
            >
              <X size={12} className="mr-1" />
              終了
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ClaudeTerminalWidget({ isOpen, onToggle }: ClaudeTerminalWidgetProps) {
  const {
    getActiveSessions,
    writeToSession,
    terminateSession,
    setDialogOpen,
    setActiveSession,
    isDialogOpen,
  } = useClaudeTerminalSession()

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)

  const activeSessions = getActiveSessions()
  const runningCount = activeSessions.filter(
    (s) => s.status === 'running' || s.status === 'initializing'
  ).length
  const askingCount = activeSessions.filter(
    (s) => s.status === 'asking_question'
  ).length

  // セッション展開トグル
  const handleToggleExpand = useCallback((sessionId: string) => {
    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId))
  }, [])

  // 全画面ダイアログを開く
  const handleOpenFullScreen = useCallback((sessionId: string) => {
    setActiveSession(sessionId)
    setDialogOpen(true)
    onToggle() // サイドバーを閉じる
  }, [setActiveSession, setDialogOpen, onToggle])

  // セッション終了
  const handleTerminate = useCallback(async (sessionId: string) => {
    await terminateSession(sessionId, true)
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null)
    }
  }, [terminateSession, expandedSessionId])

  // 入力送信
  const handleSendInput = useCallback((sessionId: string, input: string) => {
    // テキストを送信してからEnterキー（\r）を別途送信
    writeToSession(sessionId, input)
    writeToSession(sessionId, '\r')
  }, [writeToSession])

  // アクティブセッションがない、またはダイアログが開いている場合は表示しない
  if (activeSessions.length === 0 || isDialogOpen) {
    return null
  }

  // FAB表示テキスト
  const fabText = askingCount > 0
    ? `🔔 ${askingCount} 選択肢待ち`
    : runningCount > 0
      ? `${runningCount} セッション実行中`
      : `${activeSessions.length} セッション`

  // FABの色
  const fabIndicatorColor = askingCount > 0
    ? 'bg-orange-500 animate-pulse'
    : runningCount > 0
      ? 'bg-green-500 animate-pulse'
      : 'bg-gray-500'

  return (
    <>
      {/* FABトグルボタン（閉じている時のみ表示） */}
      {!isOpen && (
        <button
          className={`sidebar-toggle-fab claude-terminal-fab ${askingCount > 0 ? 'asking-question' : ''}`}
          onClick={onToggle}
          aria-label={askingCount > 0 ? '選択肢が待機中です' : 'Claude Terminalを開く'}
        >
          <div className={`w-2 h-2 rounded-full ${fabIndicatorColor}`} />
          <span className="ml-1 text-xs">{fabText}</span>
        </button>
      )}

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* Drawerサイドバー */}
      <aside className={`claude-terminal-sidebar-drawer ${isOpen ? 'open' : 'closed'}`}>
        <button
          className="sidebar-close"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        >
          <ChevronRight size={16} />
        </button>

        <div className="claude-terminal-sidebar-header">
          <Terminal size={18} />
          <h2>Claude Terminal</h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {activeSessions.length}個
          </span>
        </div>

        {/* セッションリスト */}
        <div className="claude-terminal-session-list">
          {activeSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isExpanded={expandedSessionId === session.id}
              onToggleExpand={() => handleToggleExpand(session.id)}
              onOpenFullScreen={() => handleOpenFullScreen(session.id)}
              onTerminate={() => handleTerminate(session.id)}
              onSendInput={(input) => handleSendInput(session.id, input)}
            />
          ))}
        </div>
      </aside>
    </>
  )
}
