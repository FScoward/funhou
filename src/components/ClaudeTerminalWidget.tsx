import { useState, useRef, useCallback } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useClaudeTerminalSession, type SessionStatus } from '../contexts/ClaudeTerminalSessionContext'

const STATUS_COLORS: Record<SessionStatus, string> = {
  initializing: 'bg-yellow-500',
  running: 'bg-green-500',
  waiting_input: 'bg-gray-500',  // タスク完了、次の入力待ち
  stopped: 'bg-gray-500',
  error: 'bg-red-500',
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  initializing: '初期化中...',
  running: '実行中',
  waiting_input: '完了',  // Claudeがユーザーの入力を待っている = タスク完了
  stopped: '終了',
  error: 'エラー',
}

export function ClaudeTerminalWidget() {
  const {
    activeSessionId,
    getSession,
    writeToSession,
    terminateSession,
    setDialogOpen,
    isDialogOpen,
    widgetExpanded,
    setWidgetExpanded,
  } = useClaudeTerminalSession()

  const [inputValue, setInputValue] = useState('')
  const positionRef = useRef({ x: window.innerWidth - 320, y: window.innerHeight - 200 })
  const widgetRef = useRef<HTMLDivElement>(null)

  const activeSession = activeSessionId ? getSession(activeSessionId) : null

  // 入力送信
  const handleSendInput = useCallback(() => {
    if (!activeSessionId || !inputValue.trim()) return
    writeToSession(activeSessionId, inputValue + '\n')
    setInputValue('')
  }, [activeSessionId, inputValue, writeToSession])

  // 全画面ダイアログを開く
  const handleOpenFullScreen = useCallback(() => {
    setDialogOpen(true)
  }, [setDialogOpen])

  // セッション終了
  const handleTerminate = useCallback(async () => {
    if (activeSessionId) {
      await terminateSession(activeSessionId, true)
    }
  }, [activeSessionId, terminateSession])

  // ドラッグ処理
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    const startX = e.clientX
    const startY = e.clientY
    const startPosX = positionRef.current.x
    const startPosY = positionRef.current.y
    const widget = widgetRef.current
    if (!widget) return

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      const newX = Math.max(0, Math.min(window.innerWidth - 300, startPosX + deltaX))
      const newY = Math.max(0, Math.min(window.innerHeight - 50, startPosY + deltaY))
      widget.style.left = `${newX}px`
      widget.style.top = `${newY}px`
      positionRef.current = { x: newX, y: newY }
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  // アクティブセッションがなければウィジェットを表示しない
  // ダイアログが開いている場合も表示しない
  // 注意: この条件チェックは全てのフックの後に行う（React Hooksのルール）
  if (!activeSession || isDialogOpen) {
    return null
  }

  const status = activeSession.status
  const statusColor = STATUS_COLORS[status]
  const statusLabel = STATUS_LABELS[status]

  return (
    <div
      ref={widgetRef}
      className="fixed z-50 bg-background border rounded-lg shadow-lg overflow-hidden flex flex-col"
      style={{
        left: positionRef.current.x,
        top: positionRef.current.y,
        width: widgetExpanded ? 300 : 220,
      }}
    >
      {/* ヘッダー（ドラッグハンドル） */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className={`w-2 h-2 rounded-full ${statusColor} ${status === 'running' || status === 'initializing' ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium flex-1 truncate">
          Claude ({statusLabel})
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              setWidgetExpanded(!widgetExpanded)
            }}
          >
            {widgetExpanded ? '−' : '▲'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation()
              handleTerminate()
            }}
          >
            ×
          </Button>
        </div>
      </div>

      {/* 展開時のコンテンツ */}
      {widgetExpanded && (
        <div className="p-2 space-y-2">
          {/* 入力エリア */}
          <div className="flex gap-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendInput()
                }
              }}
              placeholder="Claudeへの入力..."
              className="flex-1 h-8 text-sm"
            />
            <Button size="sm" className="h-8" onClick={handleSendInput}>
              送信
            </Button>
          </div>

          {/* 全画面ボタン */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleOpenFullScreen}
          >
            全画面で開く
          </Button>
        </div>
      )}
    </div>
  )
}
