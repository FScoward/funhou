import { ListTodo, ChevronRight, ExternalLink, Circle } from 'lucide-react'
import { IncompleteTodoItem } from '@/types'
import { formatDateToLocalYYYYMMDD } from '@/utils/dateUtils'

interface IncompleteTasksSidebarProps {
  incompleteTodos: IncompleteTodoItem[]
  isLoading?: boolean
  onItemClick: (entryId: number) => void
  onStatusChange: (todo: IncompleteTodoItem) => Promise<void>
  isOpen: boolean
  onToggle: () => void
}

// タスクを日付別にグルーピング
function groupByDate(todos: IncompleteTodoItem[]): Map<string, IncompleteTodoItem[]> {
  const grouped = new Map<string, IncompleteTodoItem[]>()

  for (const todo of todos) {
    const date = new Date(todo.timestamp)
    const dateKey = formatDateToLocalYYYYMMDD(date)

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(todo)
  }

  return grouped
}

// 日付を日本語でフォーマット
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const todayStr = formatDateToLocalYYYYMMDD(today)
  const yesterdayStr = formatDateToLocalYYYYMMDD(yesterday)

  if (dateStr === todayStr) {
    return '今日'
  } else if (dateStr === yesterdayStr) {
    return '昨日'
  } else {
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[date.getDay()]
    return `${month}月${day}日（${weekday}）`
  }
}

export function IncompleteTasksSidebar({
  incompleteTodos,
  isLoading = false,
  onItemClick,
  onStatusChange,
  isOpen,
  onToggle
}: IncompleteTasksSidebarProps) {
  const groupedTodos = groupByDate(incompleteTodos)

  return (
    <>
      {/* トグルボタン（常に表示） */}
      {!isOpen && (
        <button
          className="incomplete-sidebar-toggle-fab"
          onClick={onToggle}
          aria-label="未完了タスクを開く"
        >
          <ListTodo size={14} />
          {incompleteTodos.length > 0 && (
            <span className="incomplete-sidebar-toggle-count">{incompleteTodos.length}</span>
          )}
        </button>
      )}

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="sidebar-overlay incomplete-overlay"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* Drawerサイドバー */}
      <aside className={`incomplete-sidebar-drawer ${isOpen ? 'open' : 'closed'}`}>
        <button
          className="sidebar-close"
          onClick={onToggle}
          aria-label="サイドバーを閉じる"
        >
          <ChevronRight size={16} />
        </button>

        <div className="incomplete-sidebar-header">
          <ListTodo size={18} />
          <h2>未完了タスク</h2>
          {incompleteTodos.length > 0 && (
            <span className="incomplete-count">{incompleteTodos.length}</span>
          )}
        </div>

        {isLoading ? (
          <div className="incomplete-sidebar-empty">読み込み中...</div>
        ) : incompleteTodos.length === 0 ? (
          <div className="incomplete-sidebar-empty">
            未完了のタスクはありません
          </div>
        ) : (
          <div className="incomplete-sidebar-list">
            {Array.from(groupedTodos.entries()).map(([dateKey, todos]) => (
              <div key={dateKey} className="incomplete-date-group">
                <div className="incomplete-date-header">
                  {formatDateLabel(dateKey)}
                  <span className="incomplete-date-count">({todos.length})</span>
                </div>
                {todos.map((item) => (
                  <div
                    key={`${item.replyId ?? item.entryId}-${item.lineIndex}`}
                    className="incomplete-sidebar-item"
                    onClick={() => {
                      onItemClick(item.entryId)
                      onToggle()
                    }}
                  >
                    <button
                      className="incomplete-item-checkbox"
                      onClick={async (e) => {
                        e.stopPropagation()
                        await onStatusChange(item)
                      }}
                      title="DOINGに変更"
                    >
                      <Circle size={14} />
                    </button>
                    <span className="incomplete-item-text">{item.text}</span>
                    <button
                      className="incomplete-item-jump"
                      onClick={(e) => {
                        e.stopPropagation()
                        onItemClick(item.entryId)
                        onToggle()
                      }}
                      title="エントリーに移動"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}
