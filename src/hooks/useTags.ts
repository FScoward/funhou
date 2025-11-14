import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { Tag } from '@/types'
import { getAllTags, deleteTag } from '@/lib/tags'

interface UseTagsProps {
  database: Database | null
  loadEntries: () => Promise<void>
}

export function useTags({ database, loadEntries }: UseTagsProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterMode, setFilterMode] = useState<'AND' | 'OR'>('OR')
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null)
  const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false)

  const loadAvailableTags = async () => {
    if (!database) return

    try {
      const tags = await getAllTags(database)
      setAvailableTags(tags)
    } catch (error) {
      console.error('タグの読み込みに失敗しました:', error)
    }
  }

  // データベースが利用可能になったら初期化時にタグを読み込む
  useEffect(() => {
    if (database) {
      loadAvailableTags()
    }
  }, [database])

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const openDeleteTagDialog = (tagName: string) => {
    setDeleteTagTarget(tagName)
    setDeleteTagDialogOpen(true)
  }

  const handleDeleteTag = async () => {
    if (!database || deleteTagTarget === null) return

    try {
      await deleteTag(database, deleteTagTarget)

      // 削除したタグがフィルターに選択されていたら除外
      setSelectedTags(selectedTags.filter(t => t !== deleteTagTarget))

      // タグ一覧を更新
      await loadAvailableTags()

      // エントリーを再読み込み
      await loadEntries()

      // ダイアログを閉じる
      setDeleteTagDialogOpen(false)
      setDeleteTagTarget(null)
    } catch (error) {
      console.error('タグの削除に失敗しました:', error)
    }
  }

  return {
    // State
    selectedTags,
    setSelectedTags,
    filterMode,
    setFilterMode,
    availableTags,
    deleteTagDialogOpen,
    setDeleteTagDialogOpen,
    deleteTagTarget,
    // Handlers
    loadAvailableTags,
    handleTagClick,
    openDeleteTagDialog,
    handleDeleteTag,
  }
}
