import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { IncompleteTodoItem, Entry, Reply } from '@/types'
import { CHECKBOX_PATTERN_ALL } from '@/utils/checkboxUtils'

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

      for (const entry of entries) {
        const lines = entry.content.split('\n')
        lines.forEach((line, index) => {
          const match = line.match(CHECKBOX_PATTERN_ALL)
          if (match && match[2] === ' ') {
            todos.push({
              entryId: entry.id,
              lineIndex: index + 1,
              text: match[3].trim(),
              timestamp: entry.timestamp
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
              timestamp: reply.timestamp
            })
          }
        })
      }

      // タイムスタンプの新しい順にソート
      todos.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setIncompleteTodos(todos)
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

  return {
    incompleteTodos,
    isLoading,
    loadIncompleteTodos,
    updateToDoingStatus
  }
}
