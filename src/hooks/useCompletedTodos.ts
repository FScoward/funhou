import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { CompletedTodoItem, Entry, Reply } from '@/types'
import { CHECKBOX_PATTERN_ALL, parseClosedTimestamp } from '@/utils/checkboxUtils'
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

      // 完了チェックボックス [x] または [X] を含むエントリーを取得（アーカイブ除外）
      const entries = await database.select<Entry[]>(
        `SELECT id, content, timestamp FROM entries
         WHERE (archived = 0 OR archived IS NULL)
         AND (content LIKE '%[x]%' OR content LIKE '%[X]%')`
      )

      const completed: CompletedTodoItem[] = []

      // エントリーから完了タスクを抽出
      for (const entry of entries) {
        const lines = entry.content.split('\n')
        for (let index = 0; index < lines.length; index++) {
          const line = lines[index]
          const match = line.match(CHECKBOX_PATTERN_ALL)
          if (match && (match[2] === 'x' || match[2] === 'X')) {
            // 次の行からCLOSED時刻を抽出
            let completedAt: string | undefined
            let completedDate: Date | null = null
            if (index + 1 < lines.length) {
              completedDate = parseClosedTimestamp(lines[index + 1])
              if (completedDate) {
                completedAt = completedDate.toISOString()
              }
            }

            // CLOSED日付が選択日付と一致するかチェック
            if (completedDate) {
              const completedDateStr = formatDateToLocalYYYYMMDD(completedDate)
              if (completedDateStr !== dateStr) {
                continue // 選択日付と異なる場合はスキップ
              }
            } else {
              // CLOSED行がない場合は、エントリーの作成日でフォールバック
              const entryDate = new Date(entry.timestamp)
              const entryDateStr = formatDateToLocalYYYYMMDD(entryDate)
              if (entryDateStr !== dateStr) {
                continue
              }
            }

            completed.push({
              entryId: entry.id,
              lineIndex: index + 1,
              text: match[3].trim(),
              status: match[2] as 'x' | 'X',
              entryTimestamp: entry.timestamp,
              completedAt
            })
          }
        }
      }

      // 返信からも完了タスクを取得（アーカイブ除外）
      const replies = await database.select<(Reply & { entry_id: number })[]>(
        `SELECT r.id, r.entry_id, r.content, r.timestamp FROM replies r
         JOIN entries e ON r.entry_id = e.id
         WHERE (e.archived = 0 OR e.archived IS NULL)
         AND (r.archived = 0 OR r.archived IS NULL)
         AND (r.content LIKE '%[x]%' OR r.content LIKE '%[X]%')`
      )

      for (const reply of replies) {
        const lines = reply.content.split('\n')
        for (let index = 0; index < lines.length; index++) {
          const line = lines[index]
          const match = line.match(CHECKBOX_PATTERN_ALL)
          if (match && (match[2] === 'x' || match[2] === 'X')) {
            // 次の行からCLOSED時刻を抽出
            let completedAt: string | undefined
            let completedDate: Date | null = null
            if (index + 1 < lines.length) {
              completedDate = parseClosedTimestamp(lines[index + 1])
              if (completedDate) {
                completedAt = completedDate.toISOString()
              }
            }

            // CLOSED日付が選択日付と一致するかチェック
            if (completedDate) {
              const completedDateStr = formatDateToLocalYYYYMMDD(completedDate)
              if (completedDateStr !== dateStr) {
                continue // 選択日付と異なる場合はスキップ
              }
            } else {
              // CLOSED行がない場合は、返信の作成日でフォールバック
              const replyDate = new Date(reply.timestamp)
              const replyDateStr = formatDateToLocalYYYYMMDD(replyDate)
              if (replyDateStr !== dateStr) {
                continue
              }
            }

            completed.push({
              entryId: reply.entry_id,
              replyId: reply.id,
              lineIndex: index + 1,
              text: match[3].trim(),
              status: match[2] as 'x' | 'X',
              entryTimestamp: reply.timestamp,
              completedAt
            })
          }
        }
      }

      // completedAtがあればそれを、なければentryTimestampで新しい順にソート
      completed.sort((a, b) => {
        const timeA = a.completedAt || a.entryTimestamp
        const timeB = b.completedAt || b.entryTimestamp
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })

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
