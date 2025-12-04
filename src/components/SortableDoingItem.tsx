import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ExternalLink, Circle, Slash, CheckCircle, XCircle } from 'lucide-react'
import { TodoItem, getTodoUniqueId } from '@/types'
import { CheckboxStatus } from '@/utils/checkboxUtils'

// 親エントリIDから色相を生成（0-360）
function getHueFromEntryId(entryId: number): number {
  // ゴールデンアングル（137.5度）を使って色を分散させる
  return (entryId * 137.5) % 360
}

// ステータスメニューの定義
const STATUS_OPTIONS: { status: CheckboxStatus; label: string; icon: React.ReactNode }[] = [
  { status: ' ', label: '未完了', icon: <Circle size={14} /> },
  { status: '/', label: 'DOING', icon: <Slash size={14} /> },
  { status: 'x', label: '完了', icon: <CheckCircle size={14} /> },
  { status: '-', label: 'キャンセル', icon: <XCircle size={14} /> },
]

interface SortableDoingItemProps {
  todo: TodoItem
  onStatusChange?: (todo: TodoItem, newStatus: CheckboxStatus) => Promise<void>
  onScrollToEntry?: (entryId: number) => void
  onScrollToReply?: (replyId: number) => void
}

export function SortableDoingItem({
  todo,
  onStatusChange,
  onScrollToEntry,
  onScrollToReply,
}: SortableDoingItemProps) {
  const uniqueId = getTodoUniqueId(todo)
  const isReplyTask = !!todo.replyId
  const hasChildren = (todo.childCount ?? 0) > 0

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

  // 親エントリIDから色を生成（濃い色）
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
    'doing-list-item',
    isDragging && 'is-dragging',
    isReplyTask && 'is-child',
    hasChildren && 'has-children',
    todo.isLastChild && 'is-last-child',
  ].filter(Boolean).join(' ')

  // 右クリックハンドラ
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onStatusChange) return
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
        onContextMenu={handleContextMenu}
      >
        <button
          className="doing-list-item-drag-handle"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>

        {onStatusChange && (
          <button
            className="doing-list-item-checkbox"
            onClick={() => onStatusChange(todo, 'x')}
            title="完了にする"
          />
        )}

        <span className="doing-list-item-text">{todo.text}</span>

        {/* 子タスクバッジ（親の場合） */}
        {hasChildren && (
          <span className="doing-list-item-badge">+{todo.childCount}</span>
        )}

        {todo.replyId && onScrollToReply ? (
          <button
            className="doing-list-item-jump"
            onClick={() => onScrollToReply(todo.replyId!)}
            title="返信に移動"
          >
            <ExternalLink size={14} />
          </button>
        ) : onScrollToEntry && (
          <button
            className="doing-list-item-jump"
            onClick={() => onScrollToEntry(todo.entryId)}
            title="エントリーに移動"
          >
            <ExternalLink size={14} />
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
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.status}
              className={`checkbox-status-option ${option.status === '/' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (onStatusChange) {
                  onStatusChange(todo, option.status)
                }
                setMenuOpen(false)
              }}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
