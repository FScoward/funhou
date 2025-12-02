import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { TodoItem, Entry, Reply } from '@/types'
import {
  CHECKBOX_PATTERN_INCOMPLETE,
  CHECKBOX_PATTERN_ALL,
  type CheckboxStatus
} from '@/utils/checkboxUtils'

interface UseTodosProps {
  database: Database | null
}

export function useTodos({ database }: UseTodosProps) {
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadTodos = useCallback(async () => {
    if (!database) return

    setIsLoading(true)
    try {
      // アーカイブされていないエントリーを取得（未完了 [ ] またはDOING [/] を含む）
      const entries = await database.select<Entry[]>(
        'SELECT id, content FROM entries WHERE (archived = 0 OR archived IS NULL) AND (content LIKE ? OR content LIKE ?)',
        ['%[ ]%', '%[/]%']
      )

      const todos: TodoItem[] = []

      for (const entry of entries) {
        const lines = entry.content.split('\n')
        lines.forEach((line, index) => {
          const match = line.match(CHECKBOX_PATTERN_INCOMPLETE)
          if (match) {
            todos.push({
              entryId: entry.id,
              lineIndex: index + 1, // 1始まり
              text: match[3].trim(),
              status: match[2] as ' ' | '/'
            })
          }
        })
      }

      // 返信からもTODOを取得（親エントリーがアーカイブされていないもの）
      const replies = await database.select<(Reply & { entry_id: number })[]>(
        `SELECT r.id, r.entry_id, r.content
         FROM replies r
         JOIN entries e ON r.entry_id = e.id
         WHERE (e.archived = 0 OR e.archived IS NULL)
         AND (r.content LIKE ? OR r.content LIKE ?)`,
        ['%[ ]%', '%[/]%']
      )

      for (const reply of replies) {
        const lines = reply.content.split('\n')
        lines.forEach((line, index) => {
          const match = line.match(CHECKBOX_PATTERN_INCOMPLETE)
          if (match) {
            todos.push({
              entryId: reply.entry_id,
              replyId: reply.id,
              lineIndex: index + 1, // 1始まり
              text: match[3].trim(),
              status: match[2] as ' ' | '/'
            })
          }
        })
      }

      setTodoItems(todos)
    } catch (error) {
      console.error('TODO項目の読み込みに失敗しました:', error)
    } finally {
      setIsLoading(false)
    }
  }, [database])

  // エントリー内の特定の行を更新する（更新後のコンテンツを返す）
  const updateEntryLine = useCallback(async (
    entryId: number,
    lineIndex: number,
    newStatus: CheckboxStatus
  ): Promise<string | null> => {
    if (!database) return null

    try {
      const entries = await database.select<Entry[]>(
        'SELECT content FROM entries WHERE id = ?',
        [entryId]
      )

      if (entries.length > 0) {
        const lines = entries[0].content.split('\n')
        const index = lineIndex - 1

        if (index >= 0 && index < lines.length) {
          const match = lines[index].match(CHECKBOX_PATTERN_ALL)

          if (match) {
            lines[index] = `${match[1]}[${newStatus}]${match[3]}`
            const newContent = lines.join('\n')

            await database.execute(
              'UPDATE entries SET content = ? WHERE id = ?',
              [newContent, entryId]
            )

            return newContent
          }
        }
      }
    } catch (error) {
      console.error('エントリー行の更新に失敗しました:', error)
    }
    return null
  }, [database])

  // 返信内の特定の行を更新する（更新後のコンテンツを返す）
  const updateReplyLine = useCallback(async (
    replyId: number,
    lineIndex: number,
    newStatus: CheckboxStatus
  ): Promise<string | null> => {
    if (!database) return null

    try {
      const replies = await database.select<Reply[]>(
        'SELECT content FROM replies WHERE id = ?',
        [replyId]
      )

      if (replies.length > 0) {
        const lines = replies[0].content.split('\n')
        const index = lineIndex - 1

        if (index >= 0 && index < lines.length) {
          const match = lines[index].match(CHECKBOX_PATTERN_ALL)

          if (match) {
            lines[index] = `${match[1]}[${newStatus}]${match[3]}`
            const newContent = lines.join('\n')

            await database.execute(
              'UPDATE replies SET content = ? WHERE id = ?',
              [newContent, replyId]
            )

            return newContent
          }
        }
      }
    } catch (error) {
      console.error('返信行の更新に失敗しました:', error)
    }
    return null
  }, [database])

  return {
    todoItems,
    isLoading,
    loadTodos,
    updateEntryLine,
    updateReplyLine
  }
}
