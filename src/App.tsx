import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import './App.css'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Trash2, Settings, Pencil, X } from 'lucide-react'
import { ja } from 'date-fns/locale'
import { SettingsDialog } from '@/components/SettingsDialog'
import { getSettings } from '@/lib/settings'
import { getCurrentWindow } from '@tauri-apps/api/window'
import CustomInput from '@/components/CustomInput'
import { TagFilter } from '@/components/TagFilter'
import { TagBadge } from '@/components/TagBadge'
import {
  extractTagsFromContent,
  associateTagsWithEntry,
  getTagsForEntry,
  associateTagsWithReply,
  getTagsForReply,
  getAllTags,
  buildTagFilterCondition,
  buildReplyTagFilterCondition,
  deleteTag,
  type Tag as TagType
} from '@/lib/tags'

interface Tag {
  id: number
  name: string
}

interface Entry {
  id: number
  content: string
  timestamp: string
  tags?: Tag[]
}

interface Reply {
  id: number
  entry_id: number
  content: string
  timestamp: string
  tags?: Tag[]
}

interface TimelineItem {
  type: 'entry' | 'reply'
  id: number
  content: string
  timestamp: string
  // entry specific fields
  replies?: Reply[]
  replyCount?: number
  tags?: Tag[]
  // reply specific fields
  replyId?: number
  entryId?: number
  parentEntry?: {
    id: number
    content: string
  }
}

let db: Database | null = null

async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:funhou.db')

    // テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL
      )
    `)

    // 設定テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // デフォルト設定を挿入（既に存在しない場合のみ）
    await db.execute(`
      INSERT OR IGNORE INTO settings (key, value) VALUES ('always_on_top', 'false')
    `)

    // 返信テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
      )
    `)

    // インデックス作成
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_replies_entry_id ON replies(entry_id)
    `)

    // タグテーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `)

    // エントリーとタグの中間テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS entry_tags (
        entry_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (entry_id, tag_id),
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `)

    // タグ検索用のインデックスを作成
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON entry_tags(entry_id)
    `)
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id)
    `)

    // 返信とタグの中間テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reply_tags (
        reply_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (reply_id, tag_id),
        FOREIGN KEY (reply_id) REFERENCES replies(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `)

    // 返信タグ検索用のインデックスを作成
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_reply_tags_reply_id ON reply_tags(reply_id)
    `)
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_reply_tags_tag_id ON reply_tags(tag_id)
    `)
  }
  return db
}

// ローカルタイムゾーンを考慮した日付文字列を生成（YYYY-MM-DD形式）
function formatDateToLocalYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ja-JP')
  }

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
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

  // 日本語の日付フォーマット（曜日付き）
  const formatDateWithWeekday = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[date.getDay()]
    return `${year}年${month}月${day}日（${weekday}）`
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
        <div className="date-navigation">
          <div className="settings-spacer"></div>
          <div className="date-navigation-center">
            <button onClick={goToPreviousDay} className="nav-button">
              ◀
            </button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="date-display" style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
                  {formatDateWithWeekday(selectedDate)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date)
                      setCalendarOpen(false)
                    }
                  }}
                  locale={ja}
                  captionLayout="dropdown"
                  fromYear={2000}
                  toYear={2050}
                  initialFocus
                />
                <div className="p-3 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedDate(new Date())
                      setCalendarOpen(false)
                    }}
                  >
                    今日
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <button onClick={goToNextDay} className="nav-button">
              ▶
            </button>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="nav-button settings-button"
            aria-label="設定"
          >
            <Settings size={20} />
          </button>
        </div>

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
              {timelineItems.map((item, index) => {
                const itemDate = new Date(item.timestamp)
                const day = itemDate.getDate()
                const month = itemDate.toLocaleDateString('ja-JP', { month: 'short' })

                // 前のアイテムと日付を比較
                const prevItem = index > 0 ? timelineItems[index - 1] : null
                const prevDate = prevItem ? new Date(prevItem.timestamp).getDate() : null
                const showDate = prevDate !== day

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    id={`item-${item.type}-${item.id}`}
                    className={`timeline-item ${item.type === 'reply' ? 'is-reply' : ''}`}
                  >
                    <div className="timeline-date">
                      {showDate ? (
                        <>
                          <div className="date-day">{day}</div>
                          <div className="date-month">{month}</div>
                        </>
                      ) : null}
                      <div className="entry-time">{formatTimestamp(item.timestamp)}</div>
                    </div>
                    <div className="timeline-line">
                      <div className={`timeline-dot ${item.type === 'reply' ? 'is-reply' : ''}`}></div>
                    </div>
                    <div className="timeline-content">
                      {item.type === 'entry' ? (
                        <div className="entry-card">
                          <button
                            className="edit-button"
                            onClick={() => editingEntryId === item.id ? cancelEditEntry() : startEditEntry(item.id, item.content)}
                            aria-label={editingEntryId === item.id ? "キャンセル" : "編集"}
                          >
                            {editingEntryId === item.id ? <X size={16} /> : <Pencil size={16} />}
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => openDeleteDialog(item.id)}
                            aria-label="削除"
                          >
                            <Trash2 size={16} />
                          </button>
                          {editingEntryId === item.id ? (
                            <div className="edit-input-section">
                              <CustomInput
                                value={editContent}
                                onChange={setEditContent}
                                onSubmit={() => handleUpdateEntry(item.id)}
                                onKeyDown={(e) => {
                                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    e.preventDefault()
                                    handleUpdateEntry(item.id)
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault()
                                    cancelEditEntry()
                                  }
                                }}
                                placeholder="エントリーを編集..."
                                availableTags={availableTags}
                                selectedTags={editManualTags}
                                onTagAdd={(tag) => {
                                  if (!editManualTags.includes(tag)) {
                                    setEditManualTags([...editManualTags, tag])
                                  }
                                }}
                                onTagRemove={(tag) => {
                                  setEditManualTags(editManualTags.filter(t => t !== tag))
                                }}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="entry-text">{item.content}</div>
                              {/* タグ表示 */}
                              {item.tags && item.tags.length > 0 && (
                                <div className="entry-tags">
                                  {item.tags.map(tag => (
                                    <TagBadge
                                      key={tag.id}
                                      tag={tag.name}
                                      variant={selectedTags.includes(tag.name) ? 'selected' : 'default'}
                                      onClick={(tagName) => {
                                        if (selectedTags.includes(tagName)) {
                                          setSelectedTags(selectedTags.filter(t => t !== tagName))
                                        } else {
                                          setSelectedTags([...selectedTags, tagName])
                                        }
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* 返信ボタン */}
                          <div className="entry-actions">
                            <button
                              className="reply-button"
                              onClick={() => toggleReplyForm(item.id)}
                            >
                              {replyingToId === item.id ? (
                                <>
                                  <X size={16} style={{ display: 'inline-block', marginRight: '4px' }} /> キャンセル
                                </>
                              ) : (
                                <>
                                  💬 返信する{(item.replyCount ?? 0) > 0 && <span className="reply-count"> ({item.replyCount})</span>}
                                </>
                              )}
                            </button>
                            {(item.replyCount ?? 0) > 0 && (
                              <button
                                className="show-replies-button"
                                onClick={() => toggleEntryReplies(item.id)}
                              >
                                {expandedEntryReplies.has(item.id) ? '▼' : '▶'} 返信を表示
                              </button>
                            )}
                          </div>

                          {/* 返信入力フォーム */}
                          {replyingToId === item.id && (
                            <div className="reply-input-section">
                              <CustomInput
                                value={replyContent}
                                onChange={setReplyContent}
                                onSubmit={() => handleAddReply(item.id)}
                                onKeyDown={(e) => {
                                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddReply(item.id)
                                  }
                                }}
                                placeholder="返信を入力..."
                                availableTags={availableTags}
                                selectedTags={replyManualTags}
                                onTagAdd={(tag) => {
                                  if (!replyManualTags.includes(tag)) {
                                    setReplyManualTags([...replyManualTags, tag])
                                  }
                                }}
                                onTagRemove={(tag) => {
                                  setReplyManualTags(replyManualTags.filter(t => t !== tag))
                                }}
                              />
                            </div>
                          )}

                          {/* 返信一覧 */}
                          {expandedEntryReplies.has(item.id) && item.replies && item.replies.length > 0 && (
                            <div className="entry-replies-list">
                              {item.replies
                                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                                .map((reply) => (
                                  <div key={reply.id} className="entry-reply-item">
                                    <div className="entry-reply-time">{formatTimestamp(reply.timestamp)}</div>
                                    <div className="entry-reply-text">{reply.content}</div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="reply-card">
                          <button
                            className="edit-button"
                            onClick={() => editingReplyId === item.replyId ? cancelEditReply() : startEditReply(item.replyId!, item.content)}
                            aria-label={editingReplyId === item.replyId ? "キャンセル" : "編集"}
                          >
                            {editingReplyId === item.replyId ? <X size={16} /> : <Pencil size={16} />}
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => openDeleteReplyDialog(item.replyId!, item.entryId!)}
                            aria-label="削除"
                          >
                            <Trash2 size={16} />
                          </button>
                          {item.parentEntry && (
                            <button
                              className="reply-reference"
                              onClick={() => handleScrollToEntry(item.parentEntry!.id)}
                            >
                              → 「{truncateText(item.parentEntry.content)}」への返信
                            </button>
                          )}
                          {editingReplyId === item.replyId ? (
                            <div className="edit-input-section">
                              <CustomInput
                                value={editReplyContent}
                                onChange={setEditReplyContent}
                                onSubmit={() => handleUpdateReply(item.replyId!, item.entryId!)}
                                onKeyDown={(e) => {
                                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    e.preventDefault()
                                    handleUpdateReply(item.replyId!, item.entryId!)
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault()
                                    cancelEditReply()
                                  }
                                }}
                                placeholder="返信を編集..."
                                availableTags={availableTags}
                                selectedTags={editReplyManualTags}
                                onTagAdd={(tag) => {
                                  if (!editReplyManualTags.includes(tag)) {
                                    setEditReplyManualTags([...editReplyManualTags, tag])
                                  }
                                }}
                                onTagRemove={(tag) => {
                                  setEditReplyManualTags(editReplyManualTags.filter(t => t !== tag))
                                }}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="reply-text">{item.content}</div>
                              {/* タグ表示 */}
                              {item.tags && item.tags.length > 0 && (
                                <div className="entry-tags">
                                  {item.tags.map(tag => (
                                    <TagBadge
                                      key={tag.id}
                                      tag={tag.name}
                                      variant={selectedTags.includes(tag.name) ? 'selected' : 'default'}
                                      onClick={(tagName) => {
                                        if (selectedTags.includes(tagName)) {
                                          setSelectedTags(selectedTags.filter(t => t !== tagName))
                                        } else {
                                          setSelectedTags([...selectedTags, tagName])
                                        }
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>エントリーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。本当に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteReplyDialogOpen} onOpenChange={setDeleteReplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>返信を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。本当に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReply}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTagDialogOpen} onOpenChange={setDeleteTagDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>タグを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              タグ「{deleteTagTarget}」を削除します。このタグが付いているエントリーや返信からも削除されます。
              この操作は取り消せません。本当に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
