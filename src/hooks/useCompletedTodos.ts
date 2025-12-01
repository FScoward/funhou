import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { CompletedTodoItem, Entry } from '@/types'
import { CHECKBOX_PATTERN_ALL } from '@/utils/checkboxUtils'
import { formatDateToLocalYYYYMMDD } from '@/utils/dateUtils'

interface UseCompletedTodosProps {
  database: Database | null
  selectedDate: Date
}

export function useCompletedTodos({ database, selectedDate }: UseCompletedTodosProps) {
  const [completedItems, setCompletedItems] = useState<CompletedTodoItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadCompletedTodos = useCallback(async () => {
    if (!database) return

    setIsLoading(true)
    try {
      const dateStr = formatDateToLocalYYYYMMDD(selectedDate)

      // 選択中の日付で、完了チェックボックス [x] または [X] を含むエントリーを取得
      const entries = await database.select<Entry[]>(
        `SELECT id, content, timestamp FROM entries
         WHERE DATE(timestamp, 'localtime') = DATE(?)
         AND (content LIKE '%[x]%' OR content LIKE '%[X]%')`,
        [dateStr]
      )

      const completed: CompletedTodoItem[] = []

      for (const entry of entries) {
        const lines = entry.content.split('\n')
        lines.forEach((line, index) => {
          const match = line.match(CHECKBOX_PATTERN_ALL)
          if (match && (match[2] === 'x' || match[2] === 'X')) {
            completed.push({
              entryId: entry.id,
              lineIndex: index + 1,
              text: match[3].trim(),
              status: match[2] as 'x' | 'X',
              entryTimestamp: entry.timestamp
            })
          }
        })
      }

      // タイムスタンプの新しい順にソート
      completed.sort((a, b) =>
        new Date(b.entryTimestamp).getTime() - new Date(a.entryTimestamp).getTime()
      )

      setCompletedItems(completed)
    } catch (error) {
      console.error('完了タスクの読み込みに失敗しました:', error)
    } finally {
      setIsLoading(false)
    }
  }, [database, selectedDate])

  return {
    completedItems,
    isLoading,
    loadCompletedTodos
  }
}
