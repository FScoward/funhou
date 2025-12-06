import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ExternalLink, Circle, Slash, Terminal } from 'lucide-react'
import { IncompleteTodoItem, getIncompleteTodoUniqueId, TaskClaudeSession, TaskIdentifier } from '@/types'
import { formatDateToLocalYYYYMMDD } from '@/utils/dateUtils'

// 親エントリIDから色相を生成（0-360）
function getHueFromEntryId(entryId: number): number {
  return (entryId * 137.5) % 360
}

// 日付を短いラベルでフォーマット
function formatShortDateLabel(timestamp: string): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateStr = formatDateToLocalYYYYMMDD(date)
  const todayStr = formatDateToLocalYYYYMMDD(today)
  const yesterdayStr = formatDateToLocalYYYYMMDD(yesterday)

  if (dateStr === todayStr) {
    return '今日'
  } else if (dateStr === yesterdayStr) {
    return '昨日'
  } else {
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}/${day}`
  }
}

interface SortableIncompleteItemProps {
  todo: IncompleteTodoItem
  claudeSessions?: TaskClaudeSession[]
  onStatusChange: (todo: IncompleteTodoItem) => Promise<void>
  onScrollToEntry: (entryId: number) => void
  onLaunchClaude?: (task: TaskIdentifier, taskText: string) => void
  onLaunchClaudeExternal?: (task: TaskIdentifier, taskText: string) => void
  onManageSessions?: (task: TaskIdentifier, taskText: string, sessions: TaskClaudeSession[]) => void
}

export function SortableIncompleteItem({
  todo,
  claudeSessions = [],
  onStatusChange,
  onScrollToEntry,
  onLaunchClaude,
  onLaunchClaudeExternal,
  onManageSessions,
}: SortableIncompleteItemProps) {
  const uniqueId = getIncompleteTodoUniqueId(todo)
  const isReplyTask = !!todo.replyId
  const hasChildren = (todo.childCount ?? 0) > 0
  const hasClaudeSessions = claudeSessions.length > 0

  // タスク識別子
  const taskIdentifier: TaskIdentifier = {
    entryId: todo.entryId,
    replyId: todo.replyId,
    lineIndex: todo.lineIndex,
  }

  // 右クリックメニューの状態
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uniqueId })

  // 親エントリIDから色を生成
  const hue = getHueFromEntryId(todo.entryId)
  const parentColor = `hsl(${hue}, 75%, 40%)`
  const parentColorLight = `hsla(${hue}, 75%, 40%, 0.2)`

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    '--parent-color': parentColor,
    '--parent-color-light': parentColorLight,
  } as React.CSSProperties

  const itemClasses = [
    'task-item',
    'incomplete-item',
    'sortable-incomplete-item',
    isDragging && 'is-dragging',
    isReplyTask && 'is-child',
    hasChildren && 'has-children',
  ].filter(Boolean).join(' ')

  // 右クリックハンドラ
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPosition({ x: e.clientX + 8, y: e.clientY + 8 })
    setMenuOpen(true)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={itemClasses}
        data-entry-id={todo.entryId}
        data-is-child={isReplyTask}
        onClick={() => onScrollToEntry(todo.entryId)}
        onContextMenu={handleContextMenu}
      >
        <button
          className="incomplete-item-drag-handle"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>

        <button
          className="task-item-checkbox"
          onClick={async (e) => {
            e.stopPropagation()
            await onStatusChange(todo)
          }}
          title="DOINGに変更"
        >
          <Circle size={14} />
        </button>

        <span className="task-item-text">{todo.text}</span>

        {/* 日付ラベル */}
        <span className="incomplete-item-date">{formatShortDateLabel(todo.timestamp)}</span>

        {/* 子タスクバッジ（親の場合） */}
        {hasChildren && (
          <span className="incomplete-item-badge">+{todo.childCount}</span>
        )}

        <button
          className="task-item-jump"
          onClick={(e) => {
            e.stopPropagation()
            onScrollToEntry(todo.entryId)
          }}
          title="エントリーに移動"
        >
          <ExternalLink size={14} />
        </button>

        {/* Claude Code ボタン */}
        {(onLaunchClaude || onManageSessions) && (
          <button
            className="incomplete-item-claude"
            onClick={(e) => {
              e.stopPropagation()
              if (hasClaudeSessions && onManageSessions) {
                onManageSessions(taskIdentifier, todo.text, claudeSessions)
              } else if (onLaunchClaude) {
                onLaunchClaude(taskIdentifier, todo.text)
              }
            }}
            title={hasClaudeSessions ? `${claudeSessions.length}個のセッション` : 'Claude Codeを起動'}
          >
            <Terminal size={14} />
            {hasClaudeSessions && (
              <span className="claude-badge">{claudeSessions.length}</span>
            )}
          </button>
        )}
      </div>

      {/* 右クリックメニュー（React Portal） */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          className="checkbox-status-menu"
          style={{
            position: 'fixed',
            left: menuPosition.x,
            top: menuPosition.y,
          }}
        >
          {/* DOINGに変更 */}
          <button
            className="checkbox-status-option"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onStatusChange(todo)
              setMenuOpen(false)
            }}
          >
            <Slash size={14} />
            <span>DOINGに変更</span>
          </button>

          {/* Claude Code 関連メニュー */}
          {(onLaunchClaude || onLaunchClaudeExternal || onManageSessions) && (
            <>
              <div className="checkbox-status-separator" />
              {onLaunchClaude && (
                <button
                  className="checkbox-status-option"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onLaunchClaude(taskIdentifier, todo.text)
                    setMenuOpen(false)
                  }}
                >
                  <Terminal size={14} />
                  <span>アプリ内で起動</span>
                </button>
              )}
              {onLaunchClaudeExternal && (
                <button
                  className="checkbox-status-option"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onLaunchClaudeExternal(taskIdentifier, todo.text)
                    setMenuOpen(false)
                  }}
                >
                  <Terminal size={14} />
                  <span>外部ターミナルで起動</span>
                </button>
              )}
              {hasClaudeSessions && onManageSessions && (
                <button
                  className="checkbox-status-option"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onManageSessions(taskIdentifier, todo.text, claudeSessions)
                    setMenuOpen(false)
                  }}
                >
                  <Terminal size={14} />
                  <span>セッション管理 ({claudeSessions.length})</span>
                </button>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
