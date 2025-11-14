import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import './App.css'
import { SettingsDialog } from '@/components/SettingsDialog'
import { getSettings } from '@/lib/settings'
import { getCurrentWindow } from '@tauri-apps/api/window'
import CustomInput from '@/components/CustomInput'
import { TagFilter } from '@/components/TagFilter'
import { DateNavigation } from '@/components/DateNavigation'
import { DeleteConfirmDialogs } from '@/components/DeleteConfirmDialogs'
import { TimelineItemComponent } from '@/components/TimelineItemComponent'
import {
  associateTagsWithEntry,
  getTagsForEntry,
  associateTagsWithReply,
  getTagsForReply,
  getAllTags,
  buildTagFilterCondition,
  buildReplyTagFilterCondition,
  deleteTag,
} from '@/lib/tags'
import { getDb } from '@/lib/database'
import { formatDateToLocalYYYYMMDD } from '@/utils/dateUtils'
import { TimelineItem, Entry, Reply, Tag } from '@/types'

function App() {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [currentEntry, setCurrentEntry] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [deleteReplyDialogOpen, setDeleteReplyDialogOpen] = useState(false)
  const [deleteReplyTarget, setDeleteReplyTarget] = useState<{ replyId: number; entryId: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [database, setDatabase] = useState<Database | null>(null)
  const [replyingToId, setReplyingToId] = useState<number | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [expandedEntryReplies, setExpandedEntryReplies] = useState<Set<number>>(new Set())
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null)
  const [editReplyContent, setEditReplyContent] = useState('')
  // タグフィルタリング関連の状態
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterMode, setFilterMode] = useState<'AND' | 'OR'>('OR')
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  // エントリー作成・編集時のタグ選択状態
  const [manualTags, setManualTags] = useState<string[]>([])
  const [editManualTags, setEditManualTags] = useState<string[]>([])
  // 返信作成・編集時のタグ選択状態
  const [replyManualTags, setReplyManualTags] = useState<string[]>([])
  const [editReplyManualTags, setEditReplyManualTags] = useState<string[]>([])
  // タグ削除確認ダイアログ
  const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false)
  const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null)

  useEffect(() => {
    initializeDb()
  }, [])

  useEffect(() => {
    if (database) {
      loadEntries()
      loadAvailableTags()
    }
  }, [selectedDate, database, selectedTags, filterMode])

  const initializeDb = async () => {
    const db = await getDb()
    setDatabase(db)

    // 設定を読み込んでウィンドウに適用
    try {
      const settings = await getSettings(db)
      const window = getCurrentWindow()
      await window.setAlwaysOnTop(settings.alwaysOnTop)
    } catch (error) {
      console.error('設定の適用に失敗しました:', error)
    }
  }

  const loadAvailableTags = async () => {
    if (!database) return

    try {
      const tags = await getAllTags(database)
      setAvailableTags(tags)
    } catch (error) {
      console.error('タグの読み込みに失敗しました:', error)
    }
  }

  const loadEntries = async () => {
    if (!database) return

    try {
      // 選択された日付のエントリーのみを取得（ローカルタイムゾーンを考慮）
      const dateStr = formatDateToLocalYYYYMMDD(selectedDate)

      // タグフィルタ条件を構築
      const tagFilter = buildTagFilterCondition(selectedTags, filterMode)
      const replyTagFilter = buildReplyTagFilterCondition(selectedTags, filterMode)

      // エントリーをSQLクエリで取得
      let entryQuery = 'SELECT id, content, timestamp FROM entries WHERE DATE(timestamp, \'localtime\') = DATE(?)'
      const entryParams: (string | number)[] = [dateStr]

      if (tagFilter.condition) {
        entryQuery += ` AND ${tagFilter.condition}`
        entryParams.push(...tagFilter.params)
      }

      entryQuery += ' ORDER BY timestamp DESC'

      let loadedEntries = await database.select<Entry[]>(entryQuery, entryParams)

      // 各エントリーのタグを取得
      for (const entry of loadedEntries) {
        entry.tags = await getTagsForEntry(database, entry.id)
      }

      // 返信の取得とフィルタリング
      let replies: Reply[] = []

      if (selectedTags.length > 0) {
        // タグフィルタが有効な場合：返信もタグでフィルタリング
        // タグフィルタを適用した返信を抽出
        let replyQuery = 'SELECT id, entry_id, content, timestamp FROM replies WHERE 1=1'
        const replyParams: (string | number)[] = []

        if (replyTagFilter.condition) {
          replyQuery += ` AND ${replyTagFilter.condition}`
          replyParams.push(...replyTagFilter.params)
        }

        const tagMatchedReplies = await database.select<Reply[]>(replyQuery, replyParams)

        // タグマッチした返信のタグを取得
        for (const reply of tagMatchedReplies) {
          reply.tags = await getTagsForReply(database, reply.id)
        }

        // タグマッチした返信の親エントリーIDを収集
        const tagMatchedReplyParentIds = Array.from(new Set(tagMatchedReplies.map(r => r.entry_id)))

        // 親エントリーを追加で取得（既に取得済みでないもの）
        const loadedEntryIds = new Set(loadedEntries.map(e => e.id))
        const additionalParentIds = tagMatchedReplyParentIds.filter(id => !loadedEntryIds.has(id))

        if (additionalParentIds.length > 0) {
          const additionalParents = await database.select<Entry[]>(
            `SELECT id, content, timestamp FROM entries WHERE id IN (${additionalParentIds.join(',')}) AND DATE(timestamp, 'localtime') = DATE(?)`,
            [dateStr]
          )

          // 追加エントリーのタグを取得
          for (const entry of additionalParents) {
            entry.tags = await getTagsForEntry(database, entry.id)
          }

          loadedEntries = [...loadedEntries, ...additionalParents]
        }

        // タグマッチした返信のみを使用
        replies = tagMatchedReplies
      } else {
        // タグフィルタが無効な場合：既存の動作
        const entryIds = loadedEntries.map(e => e.id)
        if (entryIds.length === 0) {
          setTimelineItems([])
          return
        }

        replies = await database.select<Reply[]>(
          `SELECT id, entry_id, content, timestamp FROM replies WHERE entry_id IN (${entryIds.join(',')})`,
          []
        )

        // 各返信のタグを取得
        for (const reply of replies) {
          reply.tags = await getTagsForReply(database, reply.id)
        }
      }

      // エントリーをTimelineItemに変換（返信リストも含める）
      const entryItems: TimelineItem[] = loadedEntries.map(entry => {
        const entryReplies = replies.filter(r => r.entry_id === entry.id)
        return {
          type: 'entry' as const,
          id: entry.id,
          content: entry.content,
          timestamp: entry.timestamp,
          replies: entryReplies,
          replyCount: entryReplies.length,
          tags: entry.tags
        }
      })

      // 返信をTimelineItemに変換（親エントリー情報も含める）
      const replyItems: TimelineItem[] = replies.map(reply => {
        const parentEntry = loadedEntries.find(e => e.id === reply.entry_id)
        return {
          type: 'reply' as const,
          id: reply.id,
          replyId: reply.id,
          entryId: reply.entry_id,
          content: reply.content,
          timestamp: reply.timestamp,
          tags: reply.tags,
          parentEntry: parentEntry ? {
            id: parentEntry.id,
            content: parentEntry.content
          } : undefined
        }
      })

      // 統合して時系列順（降順）にソート
      const allItems = [...entryItems, ...replyItems].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setTimelineItems(allItems)
    } catch (error) {
      console.error('エントリーの読み込みに失敗しました:', error)
    }
  }

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
            content: parentEntry.content
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

  const openDeleteReplyDialog = (replyId: number, entryId: number) => {
    setDeleteReplyTarget({ replyId, entryId })
    setDeleteReplyDialogOpen(true)
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

  const cancelEditEntry = () => {
    setEditingEntryId(null)
    setEditContent('')
    setEditManualTags([])
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

  const handleScrollToEntry = (entryId: number) => {
    const element = document.getElementById(`item-entry-${entryId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // ハイライト表示
      element.classList.add('highlight-flash')
      setTimeout(() => {
        element.classList.remove('highlight-flash')
      }, 2000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleAddEntry()
    }
  }

  // 日付移動関数
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  // キーボードショートカット（矢印キーとTキー）
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // textareaにフォーカスがある場合はスキップ
      if (document.activeElement?.tagName === 'TEXTAREA') {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPreviousDay()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNextDay()
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        goToToday()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedDate])

  return (
    <div className="app">
      <main>
        <DateNavigation
          selectedDate={selectedDate}
          calendarOpen={calendarOpen}
          onCalendarOpenChange={setCalendarOpen}
          onDateSelect={setSelectedDate}
          onPreviousDay={goToPreviousDay}
          onNextDay={goToNextDay}
          onToday={goToToday}
          onSettingsClick={() => setSettingsOpen(true)}
        />

        {/* タグフィルター */}
        <div className="tag-filter-section">
          <TagFilter
            availableTags={availableTags}
            selectedTags={selectedTags}
            filterMode={filterMode}
            onTagSelect={(tag) => {
              if (selectedTags.includes(tag)) {
                setSelectedTags(selectedTags.filter(t => t !== tag))
              } else {
                setSelectedTags([...selectedTags, tag])
              }
            }}
            onTagRemove={(tag) => {
              setSelectedTags(selectedTags.filter(t => t !== tag))
            }}
            onFilterModeChange={(mode) => {
              setFilterMode(mode)
            }}
            onClearAll={() => {
              setSelectedTags([])
            }}
            onTagDelete={openDeleteTagDialog}
          />
        </div>

        <div className="input-section">
          <CustomInput
            value={currentEntry}
            onChange={setCurrentEntry}
            onSubmit={handleAddEntry}
            onKeyDown={handleKeyDown}
            availableTags={availableTags}
            selectedTags={manualTags}
            onTagAdd={(tag) => {
              if (!manualTags.includes(tag)) {
                setManualTags([...manualTags, tag])
              }
            }}
            onTagRemove={(tag) => {
              setManualTags(manualTags.filter(t => t !== tag))
            }}
          />
        </div>

        <div className="timeline">
          {timelineItems.length === 0 ? (
            <p className="empty">この日の記録がありません</p>
          ) : (
            <div className="timeline-container">
              {timelineItems.map((item, index) => (
                <TimelineItemComponent
                  key={`${item.type}-${item.id}`}
                  item={item}
                  index={index}
                  previousItem={index > 0 ? timelineItems[index - 1] : null}
                  editingEntryId={editingEntryId}
                  editContent={editContent}
                  editManualTags={editManualTags}
                  editingReplyId={editingReplyId}
                  editReplyContent={editReplyContent}
                  editReplyManualTags={editReplyManualTags}
                  availableTags={availableTags}
                  selectedTags={selectedTags}
                  replyingToId={replyingToId}
                  replyContent={replyContent}
                  replyManualTags={replyManualTags}
                  expandedEntryReplies={expandedEntryReplies}
                  onEditEntry={startEditEntry}
                  onCancelEditEntry={cancelEditEntry}
                  onUpdateEntry={handleUpdateEntry}
                  onDeleteEntry={openDeleteDialog}
                  onEditContentChange={setEditContent}
                  onEditTagAdd={(tag) => {
                    if (!editManualTags.includes(tag)) {
                      setEditManualTags([...editManualTags, tag])
                    }
                  }}
                  onEditTagRemove={(tag) => {
                    setEditManualTags(editManualTags.filter(t => t !== tag))
                  }}
                  onEditReply={startEditReply}
                  onCancelEditReply={cancelEditReply}
                  onUpdateReply={handleUpdateReply}
                  onDeleteReply={openDeleteReplyDialog}
                  onEditReplyContentChange={setEditReplyContent}
                  onEditReplyTagAdd={(tag) => {
                    if (!editReplyManualTags.includes(tag)) {
                      setEditReplyManualTags([...editReplyManualTags, tag])
                    }
                  }}
                  onEditReplyTagRemove={(tag) => {
                    setEditReplyManualTags(editReplyManualTags.filter(t => t !== tag))
                  }}
                  onTagClick={handleTagClick}
                  onReplyToggle={toggleReplyForm}
                  onReplyContentChange={setReplyContent}
                  onReplyTagAdd={(tag) => {
                    if (!replyManualTags.includes(tag)) {
                      setReplyManualTags([...replyManualTags, tag])
                    }
                  }}
                  onReplyTagRemove={(tag) => {
                    setReplyManualTags(replyManualTags.filter(t => t !== tag))
                  }}
                  onAddReply={handleAddReply}
                  onToggleReplies={toggleEntryReplies}
                  onScrollToEntry={handleScrollToEntry}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <DeleteConfirmDialogs
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onDeleteEntry={handleDeleteEntry}
        deleteReplyDialogOpen={deleteReplyDialogOpen}
        onDeleteReplyDialogOpenChange={setDeleteReplyDialogOpen}
        onDeleteReply={handleDeleteReply}
        deleteTagDialogOpen={deleteTagDialogOpen}
        onDeleteTagDialogOpenChange={setDeleteTagDialogOpen}
        onDeleteTag={handleDeleteTag}
        deleteTagTarget={deleteTagTarget}
      />

      {database && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          db={database}
        />
      )}
    </div>
  )
}

export default App
