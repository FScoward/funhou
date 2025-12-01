import { useState, useEffect, useCallback } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { Entry, TodoItem } from '@/types'
import { associateTagsWithEntry, getTagsForEntry } from '@/lib/tags'

interface UseCurrentActivityProps {
  database: Database | null
  loadAvailableTags: () => Promise<void>
  loadEntries: () => Promise<void>
}

export function useCurrentActivity({ database, loadAvailableTags, loadEntries }: UseCurrentActivityProps) {
  const [currentActivity, setCurrentActivity] = useState<Entry | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadCurrentActivity = useCallback(async () => {
    if (!database) return

    try {
      setIsLoading(true)
      const result = await database.select<Entry[]>(
        'SELECT id, content, timestamp, pinned, archived, is_current FROM entries WHERE is_current = 1 LIMIT 1'
      )

      if (result.length > 0) {
        const entry = result[0]
        entry.tags = await getTagsForEntry(database, entry.id)
        setCurrentActivity(entry)
      } else {
        setCurrentActivity(null)
      }
    } catch (error) {
      console.error('今何してる？の読み込みに失敗しました:', error)
    } finally {
      setIsLoading(false)
    }
  }, [database])

  useEffect(() => {
    if (database) {
      loadCurrentActivity()
    }
  }, [database, loadCurrentActivity])

  const saveCurrentActivity = async (content: string, tags: string[] = []) => {
    if (!database || !content.trim()) return

    try {
      // 既存のis_current=1をすべて0にリセット
      await database.execute('UPDATE entries SET is_current = 0 WHERE is_current = 1')

      // 新しいエントリーをis_current=1で保存
      const timestamp = new Date().toISOString()
      const result = await database.execute(
        'INSERT INTO entries (content, timestamp, is_current) VALUES (?, ?, 1)',
        [content, timestamp]
      )

      const entryId = Number(result.lastInsertId)

      // タグを保存
      if (tags.length > 0) {
        await associateTagsWithEntry(database, entryId, tags)
      }

      // 保存したタグを取得
      const savedTags = await getTagsForEntry(database, entryId)

      // stateを更新
      const newEntry: Entry = {
        id: entryId,
        content,
        timestamp,
        tags: savedTags,
        is_current: 1
      }
      setCurrentActivity(newEntry)

      // タグ一覧とタイムラインを更新
      await loadAvailableTags()
      await loadEntries()
    } catch (error) {
      console.error('今何してる？の保存に失敗しました:', error)
    }
  }

  const clearCurrentActivity = async () => {
    if (!database || !currentActivity) return

    try {
      // is_current=0にする（エントリーは削除しない）
      await database.execute(
        'UPDATE entries SET is_current = 0 WHERE id = ?',
        [currentActivity.id]
      )

      setCurrentActivity(null)
      await loadEntries()
    } catch (error) {
      console.error('今何してる？のクリアに失敗しました:', error)
    }
  }

  // TODOを選択して「今何してる？」に設定（記録は残さない、表示のみ）
  const selectTodoAsCurrentActivity = async (todo: TodoItem) => {
    if (!database) return

    try {
      // 1. 元エントリーの該当行を `- [/]` に更新
      const entries = await database.select<Entry[]>(
        'SELECT content, timestamp FROM entries WHERE id = ?',
        [todo.entryId]
      )

      if (entries.length > 0) {
        const lines = entries[0].content.split('\n')
        const index = todo.lineIndex - 1

        if (index >= 0 && index < lines.length) {
          // `- [ ]` を `- [/]` に置換
          lines[index] = lines[index].replace(/\[[ ]\]/, '[/]')
          const newContent = lines.join('\n')

          await database.execute(
            'UPDATE entries SET content = ? WHERE id = ?',
            [newContent, todo.entryId]
          )
        }

        // 2. ローカルステートのみ更新（エントリーは作成しない）
        // 元のエントリーIDを保持してジャンプ機能を有効にする
        setCurrentActivity({
          id: todo.entryId,
          content: todo.text,
          timestamp: entries[0].timestamp,
          tags: [],
        })
      }

      // タイムラインを更新（エントリーの内容が変わったため）
      await loadEntries()
    } catch (error) {
      console.error('TODOの選択に失敗しました:', error)
    }
  }

  return {
    currentActivity,
    isLoading,
    saveCurrentActivity,
    clearCurrentActivity,
    loadCurrentActivity,
    selectTodoAsCurrentActivity,
  }
}
