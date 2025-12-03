import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ExternalLink } from 'lucide-react'
import { TodoItem, getTodoUniqueId } from '@/types'

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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uniqueId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`doing-list-item ${isDragging ? 'is-dragging' : ''}`}
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
