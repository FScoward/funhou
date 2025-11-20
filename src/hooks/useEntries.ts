import { useState } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { TimelineItem } from '@/types'
import { associateTagsWithEntry, getTagsForEntry } from '@/lib/tags'

interface UseEntriesProps {
  database: Database | null
  timelineItems: TimelineItem[]
  setTimelineItems: (items: TimelineItem[]) => void
  loadAvailableTags: () => Promise<void>
}

export function useEntries({ database, timelineItems, setTimelineItems, loadAvailableTags }: UseEntriesProps) {
  const [currentEntry, setCurrentEntry] = useState('')
  const [manualTags, setManualTags] = useState<string[]>([])
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editManualTags, setEditManualTags] = useState<string[]>([])
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleAddEntry = async () => {
    if (currentEntry.trim() && database) {
      try {
        const timestamp = new Date().toISOString()

        const result = await database.execute(
          'INSERT INTO entries (content, timestamp) VALUES (?, ?)',
          [currentEntry, timestamp]
        )

        const entryId = Number(result.lastInsertId)

        // 手動選択タグを保存
        if (manualTags.length > 0) {
          await associateTagsWithEntry(database, entryId, manualTags)
        }

        // 保存したタグを取得
        const savedTags = await getTagsForEntry(database, entryId)

        const newItem: TimelineItem = {
          type: 'entry',
          id: entryId,
          content: currentEntry,
          timestamp: timestamp,
          replies: [],
          replyCount: 0,
          tags: savedTags
        }

        setTimelineItems([newItem, ...timelineItems])
        setCurrentEntry('')
        setManualTags([]) // 手動選択タグをクリア

        // タグ一覧を更新
        loadAvailableTags()
      } catch (error) {
        console.error('エントリーの追加に失敗しました:', error)
      }
    }
  }

  const startEditEntry = async (entryId: number, currentContent: string) => {
    setEditingEntryId(entryId)
    setEditContent(currentContent)

    // 既存のタグを読み込んで手動選択タグとして設定
    if (database) {
      try {
        const existingTags = await getTagsForEntry(database, entryId)
        setEditManualTags(existingTags.map(tag => tag.name))
      } catch (error) {
        console.error('既存タグの読み込みに失敗しました:', error)
        setEditManualTags([])
      }
    }
  }

  const handleUpdateEntry = async (entryId: number) => {
    if (editContent.trim() && database) {
      try {
        await database.execute(
          'UPDATE entries SET content = ? WHERE id = ?',
          [editContent, entryId]
        )

        // 手動選択タグを保存
        await associateTagsWithEntry(database, entryId, editManualTags)

        // 更新したタグを取得
        const updatedTags = await getTagsForEntry(database, entryId)

        // stateを更新
        setTimelineItems(timelineItems.map(item =>
          item.type === 'entry' && item.id === entryId
            ? { ...item, content: editContent, tags: updatedTags }
            : item
        ))

        setEditingEntryId(null)
        setEditContent('')
        setEditManualTags([]) // 手動選択タグをクリア

        // タグ一覧を更新
        loadAvailableTags()
      } catch (error) {
        console.error('エントリーの更新に失敗しました:', error)
      }
    }
  }

  const handleDirectUpdateEntry = async (entryId: number, newContent: string) => {
    if (database) {
      try {
        await database.execute(
          'UPDATE entries SET content = ? WHERE id = ?',
          [newContent, entryId]
        )

        // stateを更新
        setTimelineItems(timelineItems.map(item =>
          item.type === 'entry' && item.id === entryId
            ? { ...item, content: newContent }
            : item
        ))
      } catch (error) {
        console.error('エントリーの直接更新に失敗しました:', error)
      }
    }
  }

  const handleDirectTagAdd = async (entryId: number, tagName: string) => {
    if (database) {
      try {
        const currentTags = await getTagsForEntry(database, entryId)
        const currentTagNames = currentTags.map(t => t.name)

        if (!currentTagNames.includes(tagName)) {
          const newTagNames = [...currentTagNames, tagName]
          await associateTagsWithEntry(database, entryId, newTagNames)

          const updatedTags = await getTagsForEntry(database, entryId)

          setTimelineItems(timelineItems.map(item =>
            item.type === 'entry' && item.id === entryId
              ? { ...item, tags: updatedTags }
              : item
          ))

          loadAvailableTags()
        }
      } catch (error) {
        console.error('タグの追加に失敗しました:', error)
      }
    }
  }

  const handleDirectTagRemove = async (entryId: number, tagName: string) => {
    if (database) {
      try {
        const currentTags = await getTagsForEntry(database, entryId)
        const newTagNames = currentTags
          .map(t => t.name)
          .filter(t => t !== tagName)

        await associateTagsWithEntry(database, entryId, newTagNames)

        const updatedTags = await getTagsForEntry(database, entryId)

        setTimelineItems(timelineItems.map(item =>
          item.type === 'entry' && item.id === entryId
            ? { ...item, tags: updatedTags }
            : item
        ))

        loadAvailableTags()
      } catch (error) {
        console.error('タグの削除に失敗しました:', error)
      }
    }
  }

  const cancelEditEntry = () => {
    setEditingEntryId(null)
    setEditContent('')
    setEditManualTags([])
  }

  const openDeleteDialog = (id: number) => {
    setDeleteTargetId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteEntry = async () => {
    if (deleteTargetId === null || !database) return

    try {
      await database.execute('DELETE FROM entries WHERE id = ?', [deleteTargetId])

      // stateからエントリーと関連する返信を削除
      setTimelineItems(timelineItems.filter((item) =>
        !(item.type === 'entry' && item.id === deleteTargetId) &&
        !(item.type === 'reply' && item.entryId === deleteTargetId)
      ))

      // ダイアログを閉じる
      setDeleteDialogOpen(false)
      setDeleteTargetId(null)
    } catch (error) {
      console.error('エントリーの削除に失敗しました:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleAddEntry()
    }
  }

  const handleTogglePin = async (entryId: number) => {
    if (!database) return

    try {
      // 現在のpinned状態を取得
      const result = await database.select<{ pinned: number }[]>(
        'SELECT pinned FROM entries WHERE id = ?',
        [entryId]
      )

      if (result.length === 0) return

      const currentPinned = result[0].pinned
      const newPinned = currentPinned === 1 ? 0 : 1

      // データベースを更新
      await database.execute(
        'UPDATE entries SET pinned = ? WHERE id = ?',
        [newPinned, entryId]
      )

      // stateを更新してソート
      const updatedItems = timelineItems.map(item =>
        item.type === 'entry' && item.id === entryId
          ? { ...item, pinned: newPinned === 1 }
          : item
      )

      // ピン留め優先でソート
      const sortedItems = updatedItems.sort((a, b) => {
        // ピン留めされたエントリーを優先
        const aPinned = a.type === 'entry' && a.pinned ? 1 : 0
        const bPinned = b.type === 'entry' && b.pinned ? 1 : 0

        if (aPinned !== bPinned) {
          return bPinned - aPinned
        }

        // 同じピン留め状態の場合は時系列順（降順）
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      setTimelineItems(sortedItems)
    } catch (error) {
      console.error('ピン留め状態の切り替えに失敗しました:', error)
    }
  }

  return {
    // State
    currentEntry,
    setCurrentEntry,
    manualTags,
    setManualTags,
    editingEntryId,
    editContent,
    setEditContent,
    editManualTags,
    setEditManualTags,
    deleteDialogOpen,
    setDeleteDialogOpen,
    // Handlers
    handleAddEntry,
    startEditEntry,
    handleUpdateEntry,
    cancelEditEntry,
    openDeleteDialog,
    handleDeleteEntry,
    handleKeyDown,
    handleTogglePin,
    handleDirectUpdateEntry,
    handleDirectTagAdd,
    handleDirectTagRemove,
  }
}
