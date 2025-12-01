import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { TodoItem, Entry } from '@/types'

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
      // 未完了 [ ] とDoing [/] のチェックボックスを抽出
      const checkboxRegex = /^(\s*[-*+]\s+)\[([ \/])\](.*)$/

      for (const entry of entries) {
        const lines = entry.content.split('\n')
        lines.forEach((line, index) => {
          const match = line.match(checkboxRegex)
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
    newStatus: ' ' | '/' | 'x'
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
          const checkboxRegex = /^(\s*[-*+]\s+)\[([ \/xX])\](.*)$/
          const match = lines[index].match(checkboxRegex)

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

  return {
    todoItems,
    isLoading,
    loadTodos,
    updateEntryLine
  }
}
