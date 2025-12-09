import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { IncompleteTodoItem, Entry, Reply, getIncompleteTodoUniqueId, Tag } from '@/types'
import { CHECKBOX_PATTERN_ALL } from '@/utils/checkboxUtils'
import { arrayMove } from '@dnd-kit/sortable'

interface IncompleteOrderRow {
  entry_id: number
  reply_id: number | null
  line_index: number
  sort_order: number
}

interface UseIncompleteTodosProps {
  database: Database | null
}

export function useIncompleteTodos({ database }: UseIncompleteTodosProps) {
  const [incompleteTodos, setIncompleteTodos] = useState<IncompleteTodoItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadIncompleteTodos = useCallback(async () => {
    if (!database) return

    setIsLoading(true)
    try {
      // アーカイブされていないエントリーから未完了タスク [ ] を取得
      const entries = await database.select<Entry[]>(
        `SELECT id, content, timestamp FROM entries
         WHERE (archived = 0 OR archived IS NULL)
         AND content LIKE '%[ ]%'
         ORDER BY timestamp DESC`
      )

      const todos: IncompleteTodoItem[] = []

      // エントリーIDからタグを取得するマップを作成
      const entryIds = entries.map(e => e.id)
      const entryTagsMap = new Map<number, Tag[]>()

      if (entryIds.length > 0) {
        for (const entryId of entryIds) {
          const tags = await database.select<Tag[]>(
            `SELECT t.id, t.name
             FROM tags t
             INNER JOIN entry_tags et ON t.id = et.tag_id
             WHERE et.entry_id = ?`,
            [entryId]
          )
          entryTagsMap.set(entryId, tags)
        }
      }

      for (const entry of entries) {
        const lines = entry.content.split('\n')
        lines.forEach((line, index) => {
          const match = line.match(CHECKBOX_PATTERN_ALL)
          if (match && match[2] === ' ') {
            todos.push({
              entryId: entry.id,
              lineIndex: index + 1,
              text: match[3].trim(),
              timestamp: entry.timestamp,
              parentEntryTags: entryTagsMap.get(entry.id) || []
            })
          }
        })
      }

      // 返信からも未完了タスクを取得
      const replies = await database.select<(Reply & { entry_id: number })[]>(
        `SELECT r.id, r.entry_id, r.content, r.timestamp
         FROM replies r
         JOIN entries e ON r.entry_id = e.id
         WHERE (e.archived = 0 OR e.archived IS NULL)
         AND (r.archived = 0 OR r.archived IS NULL)
         AND r.content LIKE '%[ ]%'
         ORDER BY r.timestamp DESC`
      )

      // 親エントリIDのリストを作成してタグを一括取得（既にマップにないものだけ）
      const parentEntryIds = [...new Set(replies.map(r => r.entry_id))]

      if (parentEntryIds.length > 0) {
        for (const entryId of parentEntryIds) {
          if (!entryTagsMap.has(entryId)) {
            const tags = await database.select<Tag[]>(
              `SELECT t.id, t.name
               FROM tags t
               INNER JOIN entry_tags et ON t.id = et.tag_id
               WHERE et.entry_id = ?`,
              [entryId]
            )
            entryTagsMap.set(entryId, tags)
          }
        }
      }

      for (const reply of replies) {
        const lines = reply.content.split('\n')
        lines.forEach((line, index) => {
          const match = line.match(CHECKBOX_PATTERN_ALL)
          if (match && match[2] === ' ') {
            todos.push({
              entryId: reply.entry_id,
              replyId: reply.id,
              lineIndex: index + 1,
              text: match[3].trim(),
              timestamp: reply.timestamp,
              parentEntryTags: entryTagsMap.get(reply.entry_id) || []
            })
          }
        })
      }

      // 保存されたソート順序を取得
      const orderData = await database.select<IncompleteOrderRow[]>(
        'SELECT entry_id, reply_id, line_index, sort_order FROM incomplete_order ORDER BY sort_order'
      )

      // ソート順序マップを作成
      const orderMap = new Map<string, number>()
      orderData.forEach(row => {
        const key = `${row.reply_id ?? row.entry_id}-${row.line_index}`
        orderMap.set(key, row.sort_order)
      })

      // カスタム順序がある場合はそれを使用、なければタイムスタンプ順
      todos.sort((a, b) => {
        const orderA = orderMap.get(getIncompleteTodoUniqueId(a))
        const orderB = orderMap.get(getIncompleteTodoUniqueId(b))

        // 両方にカスタム順序がある場合
        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB
        }
        // どちらかにしかない場合、カスタム順序がある方を先に
        if (orderA !== undefined) return -1
        if (orderB !== undefined) return 1
        // どちらもない場合はタイムスタンプの新しい順
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      // 親子関係の情報を付与
      // entryIdごとに子タスク（replyIdを持つタスク）の数をカウント
      const childCountByEntry = new Map<number, number>()
      todos.forEach(todo => {
        if (todo.replyId) {
          childCountByEntry.set(todo.entryId, (childCountByEntry.get(todo.entryId) || 0) + 1)
        }
      })

      // 親タスクにchildCount情報を付与
      const todosWithChildCount = todos.map(todo => ({
        ...todo,
        childCount: !todo.replyId ? childCountByEntry.get(todo.entryId) : undefined
      }))

      setIncompleteTodos(todosWithChildCount)
    } catch (error) {
      console.error('未完了タスクの読み込みに失敗しました:', error)
    } finally {
      setIsLoading(false)
    }
  }, [database])

  // 未完了タスクをDOING状態に変更
  const updateToDoingStatus = useCallback(async (
    todo: IncompleteTodoItem
  ): Promise<boolean> => {
    if (!database) return false

    try {
      if (todo.replyId) {
        // 返信のタスクを更新
        const replies = await database.select<Reply[]>(
          'SELECT content FROM replies WHERE id = ?',
          [todo.replyId]
        )

        if (replies.length > 0) {
          const lines = replies[0].content.split('\n')
          const index = todo.lineIndex - 1

          if (index >= 0 && index < lines.length) {
            const match = lines[index].match(CHECKBOX_PATTERN_ALL)
            if (match) {
              lines[index] = `${match[1]}[/]${match[3]}`
              const newContent = lines.join('\n')

              await database.execute(
                'UPDATE replies SET content = ? WHERE id = ?',
                [newContent, todo.replyId]
              )
              return true
            }
          }
        }
      } else {
        // エントリーのタスクを更新
        const entries = await database.select<Entry[]>(
          'SELECT content FROM entries WHERE id = ?',
          [todo.entryId]
        )

        if (entries.length > 0) {
          const lines = entries[0].content.split('\n')
          const index = todo.lineIndex - 1

          if (index >= 0 && index < lines.length) {
            const match = lines[index].match(CHECKBOX_PATTERN_ALL)
            if (match) {
              lines[index] = `${match[1]}[/]${match[3]}`
              const newContent = lines.join('\n')

              await database.execute(
                'UPDATE entries SET content = ? WHERE id = ?',
                [newContent, todo.entryId]
              )
              return true
            }
          }
        }
      }
    } catch (error) {
      console.error('タスク状態の更新に失敗しました:', error)
    }
    return false
  }, [database])

  // 未完了タスクの順序を保存する
  const saveIncompleteOrder = useCallback(async (todos: IncompleteTodoItem[]) => {
    if (!database) return

    try {
      // 既存のソート順序をクリア
      await database.execute('DELETE FROM incomplete_order')

      // 新しいソート順序を保存
      for (let i = 0; i < todos.length; i++) {
        const todo = todos[i]
        await database.execute(
          'INSERT INTO incomplete_order (entry_id, reply_id, line_index, sort_order) VALUES (?, ?, ?, ?)',
          [todo.entryId, todo.replyId ?? null, todo.lineIndex, i]
        )
      }
    } catch (error) {
      console.error('未完了タスクの順序保存に失敗しました:', error)
    }
  }, [database])

  // 未完了タスクを並び替える
  const reorderIncompleteTodos = useCallback((activeId: string, overId: string) => {
    const oldIndex = incompleteTodos.findIndex(t => getIncompleteTodoUniqueId(t) === activeId)
    const newIndex = incompleteTodos.findIndex(t => getIncompleteTodoUniqueId(t) === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(incompleteTodos, oldIndex, newIndex)
      setIncompleteTodos(reordered)
      return reordered
    }
    return null
  }, [incompleteTodos])

  return {
    incompleteTodos,
    isLoading,
    loadIncompleteTodos,
    updateToDoingStatus,
    saveIncompleteOrder,
    reorderIncompleteTodos
  }
}
