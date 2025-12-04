import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { TodoItem, getTodoUniqueId } from '@/types'
import { CheckboxStatus } from '@/utils/checkboxUtils'
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

// 親エントリIDから色相を生成
function getHueFromEntryId(entryId: number): number {
  return (entryId * 137.5) % 360
}

interface CurrentActivitySectionProps {
  isLoading?: boolean
  todoItems?: TodoItem[]
  onScrollToEntry?: (entryId: number) => void
  onScrollToReply?: (replyId: number) => void
  onStatusChange?: (todo: TodoItem, newStatus: CheckboxStatus) => Promise<void>
  onReorder?: (activeId: string, overId: string) => Promise<void>
}

export function CurrentActivitySection({
  isLoading = false,
  todoItems = [],
  onScrollToEntry,
  onScrollToReply,
  onStatusChange,
  onReorder,
}: CurrentActivitySectionProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [curves, setCurves] = useState<Array<{ path: string; color: string }>>([])

  // DOINGのみフィルタリングし、親子関係を計算
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

  useEffect(() => {
    updateLines()
    // ResizeObserverで監視
    const observer = new ResizeObserver(updateLines)
    if (listRef.current) {
      observer.observe(listRef.current)
    }
    return () => observer.disconnect()
  }, [doingTodos, updateLines])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動後にドラッグ開始
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && onReorder) {
      await onReorder(active.id as string, over.id as string)
    }
    // 並び替え後に線を更新
    setTimeout(updateLines, 50)
  }

  if (isLoading) {
    return (
      <div className="current-activity-section">
        <div className="current-activity-card">
          <div className="current-activity-header">
            <Sparkles size={18} className="current-activity-icon" />
            <span className="current-activity-label">今何してる？</span>
          </div>
          <div className="current-activity-empty">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="current-activity-section">
      <div className="current-activity-card">
        <div className="current-activity-header">
          <Sparkles size={18} className="current-activity-icon" />
          <span className="current-activity-label">今何してる？</span>
        </div>

        {doingTodos.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={doingTodos.map(getTodoUniqueId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="current-activity-doing-list" ref={listRef}>
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
                {doingTodos.map((todo) => (
                  <SortableDoingItem
                    key={getTodoUniqueId(todo)}
                    todo={todo}
                    onStatusChange={onStatusChange}
                    onScrollToEntry={onScrollToEntry}
                    onScrollToReply={onScrollToReply}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="current-activity-empty">
            なにもしていない
          </div>
        )}
      </div>
    </div>
  )
}
