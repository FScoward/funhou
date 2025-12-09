import { useState, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { TodoItem, Entry, Reply, Tag, getTodoUniqueId } from '@/types'
import {
  CHECKBOX_PATTERN_INCOMPLETE,
  CHECKBOX_PATTERN_ALL,
  createClosedLine,
  isClosedLine,
  type CheckboxStatus
} from '@/utils/checkboxUtils'
import { arrayMove } from '@dnd-kit/sortable'

interface DoingOrderRow {
  entry_id: number
  reply_id: number | null
  line_index: number
  sort_order: number
}

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
      const entries = await database.select<(Entry & { timestamp: string })[]>(
        'SELECT id, content, timestamp FROM entries WHERE (archived = 0 OR archived IS NULL) AND (content LIKE ? OR content LIKE ?)',
        ['%[ ]%', '%[/]%']
      )

      const todos: TodoItem[] = []

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
          const match = line.match(CHECKBOX_PATTERN_INCOMPLETE)
          if (match) {
            todos.push({
              entryId: entry.id,
              lineIndex: index + 1, // 1始まり
              text: match[3].trim(),
              status: match[2] as ' ' | '/',
              timestamp: entry.timestamp,
              parentEntryTags: entryTagsMap.get(entry.id) || []
            })
          }
        })
      }

      // 返信からもTODOを取得（親エントリーがアーカイブされていないもの、かつ返信自体もアーカイブされていないもの）
      const replies = await database.select<(Reply & { entry_id: number; entry_content: string; reply_timestamp: string })[]>(
        `SELECT r.id, r.entry_id, r.content, r.timestamp as reply_timestamp, e.content as entry_content
         FROM replies r
         JOIN entries e ON r.entry_id = e.id
         WHERE (e.archived = 0 OR e.archived IS NULL)
         AND (r.archived = 0 OR r.archived IS NULL)
         AND (r.content LIKE ? OR r.content LIKE ?)`,
        ['%[ ]%', '%[/]%']
      )

      // 親エントリIDのリストを作成してタグを一括取得（既にマップにないものだけ）
      const parentEntryIds = [...new Set(replies.map(r => r.entry_id))]

      if (parentEntryIds.length > 0) {
        // 各親エントリのタグを取得（まだマップにないものだけ）
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
        // 親エントリのテキストの最初の行を取得（短縮表示用）
        // チェックボックス記法を除去: "- [ ] テキスト" → "テキスト"
        let parentEntryFirstLine = reply.entry_content.split('\n')[0]
        const checkboxMatch = parentEntryFirstLine.match(/^(\s*[-*+]\s+)\[[ /xX]\]\s*(.*)$/)
        if (checkboxMatch) {
          parentEntryFirstLine = checkboxMatch[2]
        }
        parentEntryFirstLine = parentEntryFirstLine.substring(0, 50)
        const parentEntryText = parentEntryFirstLine + (parentEntryFirstLine.length >= 50 ? '...' : '')
        const parentEntryTags = entryTagsMap.get(reply.entry_id) || []

        lines.forEach((line, index) => {
          const match = line.match(CHECKBOX_PATTERN_INCOMPLETE)
          if (match) {
            todos.push({
              entryId: reply.entry_id,
              replyId: reply.id,
              lineIndex: index + 1, // 1始まり
              text: match[3].trim(),
              status: match[2] as ' ' | '/',
              timestamp: reply.reply_timestamp,
              parentEntryText,
              parentEntryTags
            })
          }
        })
      }

      // DOINGタスクにソート順序を適用
      const orderData = await database.select<DoingOrderRow[]>(
        'SELECT entry_id, reply_id, line_index, sort_order FROM doing_order ORDER BY sort_order'
      )

      // ソート順序マップを作成
      const orderMap = new Map<string, number>()
      orderData.forEach(row => {
        const key = `${row.reply_id ?? row.entry_id}-${row.line_index}`
        orderMap.set(key, row.sort_order)
      })

      // DOINGタスクとそれ以外を分離
      const doingTodos = todos.filter(t => t.status === '/')
      const otherTodos = todos.filter(t => t.status !== '/')

      // DOINGタスクをソート順序で並び替え
      doingTodos.sort((a, b) => {
        const orderA = orderMap.get(getTodoUniqueId(a)) ?? Infinity
        const orderB = orderMap.get(getTodoUniqueId(b)) ?? Infinity
        return orderA - orderB
      })

      setTodoItems([...doingTodos, ...otherTodos])
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
            // チェックボックス行を更新
            lines[index] = `${match[1]}[${newStatus}]${match[3]}`

            // 次の行がCLOSED行かどうかをチェック
            const nextLineIndex = index + 1
            const hasClosedLine = nextLineIndex < lines.length && isClosedLine(lines[nextLineIndex])

            if (newStatus === 'x' || newStatus === 'X') {
              // 完了時: CLOSED行を追加または更新
              const closedLine = createClosedLine()
              if (hasClosedLine) {
                // 既存のCLOSED行を更新
                lines[nextLineIndex] = closedLine
              } else {
                // 新しいCLOSED行を追加
                lines.splice(nextLineIndex, 0, closedLine)
              }
            } else {
              // 完了以外の状態: CLOSED行を削除
              if (hasClosedLine) {
                lines.splice(nextLineIndex, 1)
              }
            }

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
            // チェックボックス行を更新
            lines[index] = `${match[1]}[${newStatus}]${match[3]}`

            // 次の行がCLOSED行かどうかをチェック
            const nextLineIndex = index + 1
            const hasClosedLine = nextLineIndex < lines.length && isClosedLine(lines[nextLineIndex])

            if (newStatus === 'x' || newStatus === 'X') {
              // 完了時: CLOSED行を追加または更新
              const closedLine = createClosedLine()
              if (hasClosedLine) {
                // 既存のCLOSED行を更新
                lines[nextLineIndex] = closedLine
              } else {
                // 新しいCLOSED行を追加
                lines.splice(nextLineIndex, 0, closedLine)
              }
            } else {
              // 完了以外の状態: CLOSED行を削除
              if (hasClosedLine) {
                lines.splice(nextLineIndex, 1)
              }
            }

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

  // DOINGタスクの順序を保存する
  const saveDoingOrder = useCallback(async (doingTodos: TodoItem[]) => {
    if (!database) return

    try {
      // 既存のソート順序をクリア
      await database.execute('DELETE FROM doing_order')

      // 新しいソート順序を保存
      for (let i = 0; i < doingTodos.length; i++) {
        const todo = doingTodos[i]
        await database.execute(
          'INSERT INTO doing_order (entry_id, reply_id, line_index, sort_order) VALUES (?, ?, ?, ?)',
          [todo.entryId, todo.replyId ?? null, todo.lineIndex, i]
        )
      }
    } catch (error) {
      console.error('DOINGタスクの順序保存に失敗しました:', error)
    }
  }, [database])

  // DOINGタスクを並び替える
  const reorderDoingTodos = useCallback((activeId: string, overId: string) => {
    const doingTodos = todoItems.filter(todo => todo.status === '/')
    const otherTodos = todoItems.filter(todo => todo.status !== '/')

    const oldIndex = doingTodos.findIndex(t => getTodoUniqueId(t) === activeId)
    const newIndex = doingTodos.findIndex(t => getTodoUniqueId(t) === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedDoingTodos = arrayMove(doingTodos, oldIndex, newIndex)
      setTodoItems([...reorderedDoingTodos, ...otherTodos])
      return reorderedDoingTodos
    }
    return null
  }, [todoItems])

  return {
    todoItems,
    isLoading,
    loadTodos,
    updateEntryLine,
    updateReplyLine,
    saveDoingOrder,
    reorderDoingTodos
  }
}
