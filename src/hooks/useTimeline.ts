import { useState, useEffect } from 'react'
import Database from '@tauri-apps/plugin-sql'
import { TimelineItem, Entry, Reply } from '@/types'
import { formatDateToLocalYYYYMMDD } from '@/utils/dateUtils'
import { getTagsForEntry, getTagsForReply, buildTagFilterCondition, buildReplyTagFilterCondition } from '@/lib/tags'

interface UseTimelineProps {
  database: Database | null
  selectedDate: Date
  selectedTags: string[]
  filterMode: 'AND' | 'OR'
}

const ITEMS_PER_PAGE = 20

export function useTimeline({ database, selectedDate, selectedTags, filterMode }: UseTimelineProps) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => {
    if (database) {
      loadEntries()
    }
  }, [selectedDate, database, selectedTags, filterMode, currentPage])

  useEffect(() => {
    // タグやフィルタモードが変わったらページを1にリセット
    setCurrentPage(1)
  }, [selectedTags, filterMode])

  const loadEntries = async () => {
    if (!database) return

    try {
      // 選択された日付のエントリーのみを取得（ローカルタイムゾーンを考慮）
      const dateStr = formatDateToLocalYYYYMMDD(selectedDate)

      // タグフィルタ条件を構築
      const tagFilter = buildTagFilterCondition(selectedTags, filterMode)
      const replyTagFilter = buildReplyTagFilterCondition(selectedTags, filterMode)

      // タグフィルタリング時は日付を跨いで取得
      const isTagFiltering = selectedTags.length > 0

      // エントリーをSQLクエリで取得（pinned状態も含める）
      let entryQuery = 'SELECT id, content, timestamp, pinned FROM entries WHERE 1=1'
      const entryParams: (string | number)[] = []

      // タグフィルタリング時以外は日付条件を追加
      if (!isTagFiltering) {
        entryQuery += ' AND DATE(timestamp, \'localtime\') = DATE(?)'
        entryParams.push(dateStr)
      }

      if (tagFilter.condition) {
        entryQuery += ` AND ${tagFilter.condition}`
        entryParams.push(...tagFilter.params)
      }

      entryQuery += ' ORDER BY timestamp DESC'

      // ページネーション用の総件数を取得（タグフィルタリング時のみ）
      if (isTagFiltering) {
        let countQuery = 'SELECT COUNT(*) as count FROM entries WHERE 1=1'
        const countParams: (string | number)[] = []

        if (tagFilter.condition) {
          countQuery += ` AND ${tagFilter.condition}`
          countParams.push(...tagFilter.params)
        }

        const countResult = await database.select<{ count: number }[]>(countQuery, countParams)
        setTotalItems(countResult[0]?.count || 0)

        // ページネーション用のLIMITとOFFSETを追加
        const offset = (currentPage - 1) * ITEMS_PER_PAGE
        entryQuery += ` LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`
      } else {
        setTotalItems(0) // タグフィルタリングしていない時はページネーションなし
      }

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
          // タグフィルタリング時は日付条件なしで親エントリーを取得
          let additionalParentsQuery = `SELECT id, content, timestamp, pinned FROM entries WHERE id IN (${additionalParentIds.join(',')})`
          const additionalParentsParams: (string | number)[] = []

          if (!isTagFiltering) {
            additionalParentsQuery += ' AND DATE(timestamp, \'localtime\') = DATE(?)'
            additionalParentsParams.push(dateStr)
          }

          const additionalParents = await database.select<Entry[]>(
            additionalParentsQuery,
            additionalParentsParams
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
          tags: entry.tags,
          pinned: entry.pinned === 1
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

      // 統合してソート（ピン留め優先、その後時系列順）
      const allItems = [...entryItems, ...replyItems].sort((a, b) => {
        // ピン留めされたエントリーを優先
        const aPinned = a.type === 'entry' && a.pinned ? 1 : 0
        const bPinned = b.type === 'entry' && b.pinned ? 1 : 0

        if (aPinned !== bPinned) {
          return bPinned - aPinned
        }

        // 同じピン留め状態の場合は時系列順（降順）
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      setTimelineItems(allItems)
    } catch (error) {
      console.error('エントリーの読み込みに失敗しました:', error)
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

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

  return {
    timelineItems,
    setTimelineItems,
    loadEntries,
    handleScrollToEntry,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage: ITEMS_PER_PAGE,
  }
}
