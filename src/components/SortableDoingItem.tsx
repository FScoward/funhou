import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ExternalLink } from 'lucide-react'
import { TodoItem, getTodoUniqueId } from '@/types'

// 親エントリIDから色相を生成（0-360）
function getHueFromEntryId(entryId: number): number {
  // ゴールデンアングル（137.5度）を使って色を分散させる
  return (entryId * 137.5) % 360
}

interface SortableDoingItemProps {
  todo: TodoItem
  onStatusChange?: (todo: TodoItem, newStatus: 'x') => Promise<void>
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

  return (
    <div ref={setNodeRef} style={style} className={itemClasses} data-entry-id={todo.entryId}>

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
  )
}
