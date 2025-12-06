import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { CheckCircle, ListTodo, ExternalLink, Sparkles } from 'lucide-react'
import { TodoItem, CompletedTodoItem, IncompleteTodoItem, getTodoUniqueId, getIncompleteTodoUniqueId, TaskClaudeSession, TaskIdentifier, getTaskIdentifierKey } from '@/types'
import { CheckboxStatus } from '@/utils/checkboxUtils'
import { formatTimestamp } from '@/utils/dateUtils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableDoingItem } from './SortableDoingItem'
import { SortableIncompleteItem } from './SortableIncompleteItem'

// 親エントリIDから色相を生成
function getHueFromEntryId(entryId: number): number {
  return (entryId * 137.5) % 360
}


interface TaskManagementPageProps {
  // DOING tasks
  todoItems: TodoItem[]
  isTodosLoading: boolean
  onScrollToEntry: (entryId: number) => void
  onScrollToReply?: (replyId: number) => void
  onStatusChange: (todo: TodoItem, newStatus: CheckboxStatus) => Promise<void>
  onReorder: (activeId: string, overId: string) => Promise<void>
  // Completed tasks
  completedItems: CompletedTodoItem[]
  isCompletedLoading: boolean
  // Incomplete tasks
  incompleteTodos: IncompleteTodoItem[]
  isIncompleteLoading: boolean
  onIncompleteStatusChange: (todo: IncompleteTodoItem) => Promise<void>
  onIncompleteReorder: (activeId: string, overId: string) => Promise<void>
  // Claude Code sessions
  taskSessionsMap?: Map<string, TaskClaudeSession[]>
  onLaunchClaude?: (task: TaskIdentifier, taskText: string) => void
  onLaunchClaudeExternal?: (task: TaskIdentifier, taskText: string) => void
  onManageSessions?: (task: TaskIdentifier, taskText: string, sessions: TaskClaudeSession[]) => void
}

export function TaskManagementPage({
  todoItems,
  isTodosLoading,
  onScrollToEntry,
  onScrollToReply,
  onStatusChange,
  onReorder,
  completedItems,
  isCompletedLoading,
  incompleteTodos,
  isIncompleteLoading,
  onIncompleteStatusChange,
  onIncompleteReorder,
  taskSessionsMap,
  onLaunchClaude,
  onLaunchClaudeExternal,
  onManageSessions,
}: TaskManagementPageProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const incompleteListRef = useRef<HTMLDivElement>(null)
  const [curves, setCurves] = useState<Array<{ path: string; color: string }>>([])
  const [incompleteCurves, setIncompleteCurves] = useState<Array<{ path: string; color: string }>>([])

  // DOINGのみフィルタリング
  const doingTodos = useMemo(() => {
    const filtered = todoItems.filter(todo => todo.status === '/')

    // entryIdごとに子タスクの数をカウント
    const childCountByEntry = new Map<number, number>()
    filtered.forEach(todo => {
      if (todo.replyId) {
        childCountByEntry.set(todo.entryId, (childCountByEntry.get(todo.entryId) || 0) + 1)
      }
    })

    // 親子情報を付与
    return filtered.map(todo => ({
      ...todo,
      childCount: !todo.replyId ? childCountByEntry.get(todo.entryId) : undefined,
    }))
  }, [todoItems])

  // 線の位置を計算（左側レーンを通る）
  const updateLines = useCallback(() => {
    if (!listRef.current) return

    const container = listRef.current
    const containerRect = container.getBoundingClientRect()
    const items = container.querySelectorAll('.doing-list-item')

    // 親タスクの位置を記録（チェックボックスのx座標も含む）
    const parentPositions = new Map<number, { x: number; y: number; color: string }>()
    // 子タスクの位置を記録
    const childPositions: Array<{ entryId: number; x: number; y: number }> = []

    // 最初のパス: 位置を収集
    items.forEach((item) => {
      const entryId = parseInt(item.getAttribute('data-entry-id') || '0')
      const isChild = item.classList.contains('is-child')
      const checkbox = item.querySelector('.doing-list-item-checkbox')
      const checkboxRect = checkbox?.getBoundingClientRect()

      if (!checkboxRect) return

      const y = checkboxRect.top - containerRect.top + checkboxRect.height / 2
      const x = checkboxRect.left - containerRect.left + checkboxRect.width / 2

      if (!isChild) {
        const hue = getHueFromEntryId(entryId)
        parentPositions.set(entryId, { x, y, color: `hsl(${hue}, 75%, 40%)` })
      } else {
        childPositions.push({ entryId, x, y })
      }
    })

    // 線を生成（親のチェックボックスから子のチェックボックスへ）
    const newCurves: Array<{ path: string; color: string }> = []

    // 子を持つ親のリストを作成（レーン位置を決めるため）
    const parentsWithChildren: number[] = []
    parentPositions.forEach((_, entryId) => {
      const hasChildren = childPositions.some(c => c.entryId === entryId)
      if (hasChildren) {
        parentsWithChildren.push(entryId)
      }
    })

    // 各親について、子タスクへの線を描画
    parentPositions.forEach((parent, entryId) => {
      const children = childPositions.filter(c => c.entryId === entryId)
      if (children.length === 0) return

      // このエントリのレーンインデックス（被らないように）
      const laneIndex = parentsWithChildren.indexOf(entryId)
      const laneOffset = laneIndex * 10 // 各レーンは10pxずつずらす

      // 各子へのL字型の線
      children.forEach(child => {
        const checkboxRadius = 8 // チェックボックスの半径（1rem / 2 = 8px）

        // 親のチェックボックスの左端
        const startX = parent.x - checkboxRadius
        const startY = parent.y

        // 子のチェックボックスの左端
        const endX = child.x - checkboxRadius
        const endY = child.y

        // L字型：親から左へ → 下へ → 子へ（レーンオフセットで被らないように）
        const laneX = Math.min(startX, endX) - 12 - laneOffset

        const path = `M ${startX} ${startY} L ${laneX} ${startY} L ${laneX} ${endY} L ${endX} ${endY}`

        newCurves.push({
          path,
          color: parent.color,
        })
      })
    })

    setCurves(newCurves)
  }, [])

  // 未完了タスク用の線の位置を計算
  const updateIncompleteLines = useCallback(() => {
    if (!incompleteListRef.current) return

    const container = incompleteListRef.current
    const containerRect = container.getBoundingClientRect()
    const items = container.querySelectorAll('.incomplete-item')

    // 親タスクの位置を記録
    const parentPositions = new Map<number, { x: number; y: number; color: string }>()
    // 子タスクの位置を記録
    const childPositions: Array<{ entryId: number; x: number; y: number }> = []

    // 最初のパス: 位置を収集
    items.forEach((item) => {
      const entryId = parseInt(item.getAttribute('data-entry-id') || '0')
      const isChild = item.getAttribute('data-is-child') === 'true'
      const checkbox = item.querySelector('.task-item-checkbox')
      const checkboxRect = checkbox?.getBoundingClientRect()

      if (!checkboxRect) return

      const y = checkboxRect.top - containerRect.top + checkboxRect.height / 2
      const x = checkboxRect.left - containerRect.left + checkboxRect.width / 2

      if (!isChild) {
        const hue = getHueFromEntryId(entryId)
        parentPositions.set(entryId, { x, y, color: `hsl(${hue}, 75%, 40%)` })
      } else {
        childPositions.push({ entryId, x, y })
      }
    })

    // 線を生成
    const newCurves: Array<{ path: string; color: string }> = []

    // 子を持つ親のリストを作成（レーン位置を決めるため）
    const parentsWithChildren: number[] = []
    parentPositions.forEach((_, entryId) => {
      const hasChildren = childPositions.some(c => c.entryId === entryId)
      if (hasChildren) {
        parentsWithChildren.push(entryId)
      }
    })

    // 各親について、子タスクへの線を描画
    parentPositions.forEach((parent, entryId) => {
      const children = childPositions.filter(c => c.entryId === entryId)
      if (children.length === 0) return

      // このエントリのレーンインデックス
      const laneIndex = parentsWithChildren.indexOf(entryId)
      const laneOffset = laneIndex * 10

      // 各子へのL字型の線
      children.forEach(child => {
        const checkboxRadius = 7

        const startX = parent.x - checkboxRadius
        const startY = parent.y

        const endX = child.x - checkboxRadius
        const endY = child.y

        const laneX = Math.min(startX, endX) - 10 - laneOffset

        const path = `M ${startX} ${startY} L ${laneX} ${startY} L ${laneX} ${endY} L ${endX} ${endY}`

        newCurves.push({
          path,
          color: parent.color,
        })
      })
    })

    setIncompleteCurves(newCurves)
  }, [])

  useEffect(() => {
    updateLines()
    // ResizeObserverで監視
    const observer = new ResizeObserver(updateLines)
    if (listRef.current) {
      observer.observe(listRef.current)
    }
    return () => observer.disconnect()
  }, [doingTodos, updateLines])

  useEffect(() => {
    updateIncompleteLines()
    const observer = new ResizeObserver(updateIncompleteLines)
    if (incompleteListRef.current) {
      observer.observe(incompleteListRef.current)
    }
    return () => observer.disconnect()
  }, [incompleteTodos, updateIncompleteLines])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      await onReorder(active.id as string, over.id as string)
    }
    // 並び替え後に線を更新
    setTimeout(updateLines, 50)
  }

  const handleIncompleteDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      await onIncompleteReorder(active.id as string, over.id as string)
    }
    // 並び替え後に線を更新
    setTimeout(updateIncompleteLines, 50)
  }

  return (
    <div className="task-management-page">
      {/* DOING Section */}
      <section className="task-section task-section-doing">
        <div className="task-section-header">
          <Sparkles size={18} className="task-section-icon doing-icon" />
          <h2>今何してる？</h2>
          {doingTodos.length > 0 && (
            <span className="task-count doing-count">{doingTodos.length}</span>
          )}
        </div>

        {isTodosLoading ? (
          <div className="task-section-empty">読み込み中...</div>
        ) : doingTodos.length === 0 ? (
          <div className="task-section-empty">なにもしていない</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={doingTodos.map(getTodoUniqueId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="task-list doing-list" ref={listRef}>
                {/* SVG接続曲線 */}
                <svg className="doing-list-lines">
                  {curves.map((curve, i) => (
                    <path
                      key={i}
                      d={curve.path}
                      stroke={curve.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                    />
                  ))}
                </svg>
                {doingTodos.map((todo) => {
                  const taskKey = getTaskIdentifierKey({
                    entryId: todo.entryId,
                    replyId: todo.replyId,
                    lineIndex: todo.lineIndex,
                  })
                  return (
                    <SortableDoingItem
                      key={getTodoUniqueId(todo)}
                      todo={todo}
                      claudeSessions={taskSessionsMap?.get(taskKey)}
                      onStatusChange={onStatusChange}
                      onScrollToEntry={onScrollToEntry}
                      onScrollToReply={onScrollToReply}
                      onLaunchClaude={onLaunchClaude}
                      onLaunchClaudeExternal={onLaunchClaudeExternal}
                      onManageSessions={onManageSessions}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* Bottom two columns */}
      <div className="task-columns">
        {/* Incomplete Tasks Section */}
        <section className="task-section task-section-incomplete">
          <div className="task-section-header">
            <ListTodo size={18} className="task-section-icon incomplete-icon" />
            <h2>未完了タスク</h2>
            {incompleteTodos.length > 0 && (
              <span className="task-count incomplete-count">{incompleteTodos.length}</span>
            )}
          </div>

          {isIncompleteLoading ? (
            <div className="task-section-empty">読み込み中...</div>
          ) : incompleteTodos.length === 0 ? (
            <div className="task-section-empty">未完了のタスクはありません</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleIncompleteDragEnd}
            >
              <SortableContext
                items={incompleteTodos.map(getIncompleteTodoUniqueId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="task-list incomplete-list" ref={incompleteListRef}>
                  {/* SVG接続曲線 */}
                  <svg className="incomplete-list-lines">
                    {incompleteCurves.map((curve, i) => (
                      <path
                        key={i}
                        d={curve.path}
                        stroke={curve.color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                      />
                    ))}
                  </svg>
                  {incompleteTodos.map((item) => {
                    const taskKey = getTaskIdentifierKey({
                      entryId: item.entryId,
                      replyId: item.replyId,
                      lineIndex: item.lineIndex,
                    })
                    return (
                      <SortableIncompleteItem
                        key={getIncompleteTodoUniqueId(item)}
                        todo={item}
                        claudeSessions={taskSessionsMap?.get(taskKey)}
                        onStatusChange={onIncompleteStatusChange}
                        onScrollToEntry={onScrollToEntry}
                        onLaunchClaude={onLaunchClaude}
                        onLaunchClaudeExternal={onLaunchClaudeExternal}
                        onManageSessions={onManageSessions}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>

        {/* Completed Tasks Section */}
        <section className="task-section task-section-completed">
          <div className="task-section-header">
            <CheckCircle size={18} className="task-section-icon completed-icon" />
            <h2>今日やったこと</h2>
            {completedItems.length > 0 && (
              <span className="task-count completed-count">{completedItems.length}</span>
            )}
          </div>

          {isCompletedLoading ? (
            <div className="task-section-empty">読み込み中...</div>
          ) : completedItems.length === 0 ? (
            <div className="task-section-empty">完了したタスクはありません</div>
          ) : (
            <div className="task-list completed-list">
              {completedItems.map((item) => (
                <div
                  key={`${item.entryId}-${item.lineIndex}`}
                  className="task-item completed-item"
                  onClick={() => onScrollToEntry(item.entryId)}
                >
                  <div className="task-item-timestamp">
                    {formatTimestamp(item.completedAt || item.entryTimestamp)}
                  </div>
                  <div className="task-item-content">
                    <CheckCircle size={14} className="task-item-check" />
                    <span className="task-item-text">{item.text}</span>
                  </div>
                  <button
                    className="task-item-jump"
                    onClick={(e) => {
                      e.stopPropagation()
                      onScrollToEntry(item.entryId)
                    }}
                    title="エントリーに移動"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
