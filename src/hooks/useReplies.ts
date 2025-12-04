import { useState } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { TimelineItem, Reply } from '@/types'
import { associateTagsWithReply, getTagsForReply } from '@/lib/tags'

interface UseRepliesProps {
  database: Database | null
  timelineItems: TimelineItem[]
  setTimelineItems: (items: TimelineItem[]) => void
  loadAvailableTags: () => Promise<void>
}

export function useReplies({ database, timelineItems, setTimelineItems, loadAvailableTags }: UseRepliesProps) {
  const [replyingToId, setReplyingToId] = useState<number | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyManualTags, setReplyManualTags] = useState<string[]>([])
  const [expandedEntryReplies, setExpandedEntryReplies] = useState<Set<number>>(new Set())
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null)
  const [editReplyContent, setEditReplyContent] = useState('')
  const [editReplyManualTags, setEditReplyManualTags] = useState<string[]>([])
  const [deleteReplyTarget, setDeleteReplyTarget] = useState<{ replyId: number; entryId: number } | null>(null)
  const [deleteReplyDialogOpen, setDeleteReplyDialogOpen] = useState(false)

  const handleAddReply = async (entryId: number) => {
    if (replyContent.trim() && database) {
      try {
        const timestamp = new Date().toISOString()

        const result = await database.execute(
          'INSERT INTO replies (entry_id, content, timestamp) VALUES (?, ?, ?)',
          [entryId, replyContent, timestamp]
        )

        const replyId = Number(result.lastInsertId)

        // 手動選択タグを保存
        if (replyManualTags.length > 0) {
          await associateTagsWithReply(database, replyId, replyManualTags)
        }

        // 保存したタグを取得
        const savedTags = await getTagsForReply(database, replyId)

        // 親エントリーを探す
        const parentEntry = timelineItems.find(item => item.type === 'entry' && item.id === entryId)

        const newReply: Reply = {
          id: replyId,
          entry_id: entryId,
          content: replyContent,
          timestamp: timestamp,
          tags: savedTags
        }

        const newReplyItem: TimelineItem = {
          type: 'reply',
          id: replyId,
          replyId: replyId,
          entryId: entryId,
          content: replyContent,
          timestamp: timestamp,
          tags: savedTags,
          parentEntry: parentEntry ? {
            id: parentEntry.id,
            content: parentEntry.content,
            claudeSessionId: parentEntry.claudeSessionId,
            claudeCwd: parentEntry.claudeCwd,
            claudeProjectPath: parentEntry.claudeProjectPath
          } : undefined
        }

        // 親エントリーのrepliesリストも更新
        const updatedItems = timelineItems.map(item => {
          if (item.type === 'entry' && item.id === entryId) {
            return {
              ...item,
              replies: [...(item.replies || []), newReply],
              replyCount: (item.replyCount || 0) + 1
            }
          }
          return item
        })

        // 新しい返信をタイムラインに追加して時系列順に再ソート
        const allItems = [...updatedItems, newReplyItem].sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        setTimelineItems(allItems)

        // タグ一覧を更新
        loadAvailableTags()

        setReplyContent('')
        setReplyingToId(null)
        setReplyManualTags([]) // 手動選択タグをクリア
      } catch (error) {
        console.error('返信の追加に失敗しました:', error)
      }
    }
  }

  const addReplyWithContent = async (entryId: number, content: string) => {
    if (content.trim() && database) {
      try {
        const timestamp = new Date().toISOString()

        const result = await database.execute(
          'INSERT INTO replies (entry_id, content, timestamp) VALUES (?, ?, ?)',
          [entryId, content, timestamp]
        )

        const replyId = Number(result.lastInsertId)

        // 親エントリーを探す
        const parentEntry = timelineItems.find(item => item.type === 'entry' && item.id === entryId)

        const newReply: Reply = {
          id: replyId,
          entry_id: entryId,
          content: content,
          timestamp: timestamp,
          tags: []
        }

        const newReplyItem: TimelineItem = {
          type: 'reply',
          id: replyId,
          replyId: replyId,
          entryId: entryId,
          content: content,
          timestamp: timestamp,
          tags: [],
          parentEntry: parentEntry ? {
            id: parentEntry.id,
            content: parentEntry.content,
            claudeSessionId: parentEntry.claudeSessionId,
            claudeCwd: parentEntry.claudeCwd,
            claudeProjectPath: parentEntry.claudeProjectPath
          } : undefined
        }

        // 親エントリーのrepliesリストも更新
        const updatedItems = timelineItems.map(item => {
          if (item.type === 'entry' && item.id === entryId) {
            return {
              ...item,
              replies: [...(item.replies || []), newReply],
              replyCount: (item.replyCount || 0) + 1
            }
          }
          return item
        })

        // 新しい返信をタイムラインに追加して時系列順に再ソート
        const allItems = [...updatedItems, newReplyItem].sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        setTimelineItems(allItems)

        loadAvailableTags()
      } catch (error) {
        console.error('返信の追加に失敗しました:', error)
      }
    }
  }

  const toggleReplyForm = (entryId: number) => {
    if (replyingToId === entryId) {
      setReplyingToId(null)
      setReplyContent('')
      setReplyManualTags([])
    } else {
      setReplyingToId(entryId)
      setReplyContent('')
      setReplyManualTags([])
    }
  }

  const toggleEntryReplies = (entryId: number) => {
    setExpandedEntryReplies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entryId)) {
        newSet.delete(entryId)
      } else {
        newSet.add(entryId)
      }
      return newSet
    })
  }

  const startEditReply = async (replyId: number, currentContent: string) => {
    setEditingReplyId(replyId)
    setEditReplyContent(currentContent)

    // 既存のタグを読み込んで手動選択タグとして設定
    if (database) {
      try {
        const existingTags = await getTagsForReply(database, replyId)
        setEditReplyManualTags(existingTags.map(tag => tag.name))
      } catch (error) {
        console.error('既存タグの読み込みに失敗しました:', error)
        setEditReplyManualTags([])
      }
    }
  }

  const handleUpdateReply = async (replyId: number, entryId: number) => {
    if (editReplyContent.trim() && database) {
      try {
        await database.execute(
          'UPDATE replies SET content = ? WHERE id = ?',
          [editReplyContent, replyId]
        )

        // 手動選択タグを保存
        await associateTagsWithReply(database, replyId, editReplyManualTags)

        // 更新したタグを取得
        const updatedTags = await getTagsForReply(database, replyId)

        // stateを更新
        setTimelineItems(timelineItems.map(item => {
          if (item.type === 'reply' && item.replyId === replyId) {
            return { ...item, content: editReplyContent, tags: updatedTags }
          }
          // 親エントリーのrepliesリストも更新
          if (item.type === 'entry' && item.id === entryId) {
            const updatedReplies = (item.replies || []).map(reply =>
              reply.id === replyId ? { ...reply, content: editReplyContent, tags: updatedTags } : reply
            )
            return { ...item, replies: updatedReplies }
          }
          return item
        }))

        setEditingReplyId(null)
        setEditReplyContent('')
        setEditReplyManualTags([]) // 手動選択タグをクリア

        // タグ一覧を更新
        loadAvailableTags()
      } catch (error) {
        console.error('返信の更新に失敗しました:', error)
      }
    }
  }

  const cancelEditReply = () => {
    setEditingReplyId(null)
    setEditReplyContent('')
    setEditReplyManualTags([])
  }

  const openDeleteReplyDialog = (replyId: number, entryId: number) => {
    setDeleteReplyTarget({ replyId, entryId })
    setDeleteReplyDialogOpen(true)
  }

  const handleDirectUpdateReply = async (replyId: number, newContent: string) => {
    if (database) {
      try {
        await database.execute(
          'UPDATE replies SET content = ? WHERE id = ?',
          [newContent, replyId]
        )

        setTimelineItems(timelineItems.map(item => {
          if (item.type === 'reply' && item.replyId === replyId) {
            return { ...item, content: newContent }
          }
          if (item.type === 'entry' && item.replies) {
            const updatedReplies = item.replies.map(reply =>
              reply.id === replyId ? { ...reply, content: newContent } : reply
            )
            return { ...item, replies: updatedReplies }
          }
          return item
        }))
      } catch (error) {
        console.error('返信の直接更新に失敗しました:', error)
      }
    }
  }

  const handleToggleReplyArchive = async (replyId: number, entryId: number) => {
    if (!database) return

    try {
      // 現在のarchived状態を取得
      const result = await database.select<{ archived: number }[]>(
        'SELECT archived FROM replies WHERE id = ?',
        [replyId]
      )

      if (result.length === 0) return

      const currentArchived = result[0].archived ?? 0
      const newArchived = currentArchived === 1 ? 0 : 1

      // データベースを更新
      await database.execute(
        'UPDATE replies SET archived = ? WHERE id = ?',
        [newArchived, replyId]
      )

      // stateを更新（タイムラインアイテムと親エントリーのrepliesリスト両方）
      setTimelineItems(timelineItems.map(item => {
        if (item.type === 'reply' && item.replyId === replyId) {
          return { ...item, replyArchived: newArchived === 1 }
        }
        if (item.type === 'entry' && item.id === entryId) {
          const updatedReplies = (item.replies || []).map(reply =>
            reply.id === replyId ? { ...reply, archived: newArchived } : reply
          )
          return { ...item, replies: updatedReplies }
        }
        return item
      }))
    } catch (error) {
      console.error('返信のアーカイブ状態の切り替えに失敗しました:', error)
    }
  }

  const handleDeleteReply = async () => {
    if (deleteReplyTarget === null || !database) return

    try {
      await database.execute('DELETE FROM replies WHERE id = ?', [deleteReplyTarget.replyId])

      // タイムラインから返信を削除し、親エントリーの返信リストも更新
      const updatedItems = timelineItems
        .filter(item => !(item.type === 'reply' && item.replyId === deleteReplyTarget.replyId))
        .map(item => {
          if (item.type === 'entry' && item.id === deleteReplyTarget.entryId) {
            const updatedReplies = (item.replies || []).filter(r => r.id !== deleteReplyTarget.replyId)
            return {
              ...item,
              replies: updatedReplies,
              replyCount: updatedReplies.length
            }
          }
          return item
        })

      setTimelineItems(updatedItems)

      // ダイアログを閉じる
      setDeleteReplyDialogOpen(false)
      setDeleteReplyTarget(null)
    } catch (error) {
      console.error('返信の削除に失敗しました:', error)
    }
  }

  return {
    // State
    replyingToId,
    replyContent,
    setReplyContent,
    replyManualTags,
    setReplyManualTags,
    expandedEntryReplies,
    editingReplyId,
    editReplyContent,
    setEditReplyContent,
    editReplyManualTags,
    setEditReplyManualTags,
    deleteReplyDialogOpen,
    setDeleteReplyDialogOpen,
    // Handlers
    handleAddReply,
    addReplyWithContent,
    toggleReplyForm,
    toggleEntryReplies,
    startEditReply,
    handleUpdateReply,
    cancelEditReply,
    openDeleteReplyDialog,
    handleDeleteReply,
    handleDirectUpdateReply,
    handleToggleReplyArchive,
  }
}
