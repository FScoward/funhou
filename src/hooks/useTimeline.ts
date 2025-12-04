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
  searchText?: string
  onDateChange?: (date: Date) => void
}

const ITEMS_PER_PAGE = 20

export function useTimeline({ database, selectedDate, selectedTags, filterMode, searchText = '', onDateChange }: UseTimelineProps) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => {
    if (database) {
      loadEntries()
    }
  }, [selectedDate, database, selectedTags, filterMode, searchText, currentPage])

  useEffect(() => {
    // タグやフィルタモード、検索テキストが変わったらページを1にリセット
    setCurrentPage(1)
  }, [selectedTags, filterMode, searchText])

  const loadEntries = async () => {
    if (!database) return

    try {
      // 選択された日付のエントリーのみを取得（ローカルタイムゾーンを考慮）
      const dateStr = formatDateToLocalYYYYMMDD(selectedDate)

      // タグフィルタ条件を構築
      const tagFilter = buildTagFilterCondition(selectedTags, filterMode)
      const replyTagFilter = buildReplyTagFilterCondition(selectedTags, filterMode)

      // タグフィルタリングまたは検索時は日付を跨いで取得
      const isTagFiltering = selectedTags.length > 0
      const isSearching = searchText.trim().length > 0
      const isCrossDateQuery = isTagFiltering || isSearching

      // エントリーをSQLクエリで取得（pinned, archived状態も含める）
      let entryQuery = 'SELECT id, content, timestamp, pinned, archived, claude_session_id, claude_cwd, claude_project_path FROM entries WHERE 1=1'
      const entryParams: (string | number)[] = []

      // タグフィルタリングまたは検索時以外は日付条件を追加
      if (!isCrossDateQuery) {
        entryQuery += ' AND DATE(timestamp, \'localtime\') = DATE(?)'
        entryParams.push(dateStr)
      }

      if (tagFilter.condition) {
        entryQuery += ` AND ${tagFilter.condition}`
        entryParams.push(...tagFilter.params)
      }

      // 検索条件を追加
      if (isSearching) {
        entryQuery += ' AND content LIKE ?'
        entryParams.push(`%${searchText.trim()}%`)
      }

      entryQuery += ' ORDER BY timestamp DESC'

      // ページネーション用の総件数を取得（タグフィルタリングまたは検索時のみ）
      if (isCrossDateQuery) {
        let countQuery = 'SELECT COUNT(*) as count FROM entries WHERE 1=1'
        const countParams: (string | number)[] = []

        if (tagFilter.condition) {
          countQuery += ` AND ${tagFilter.condition}`
          countParams.push(...tagFilter.params)
        }

        if (isSearching) {
          countQuery += ' AND content LIKE ?'
          countParams.push(`%${searchText.trim()}%`)
        }

        const countResult = await database.select<{ count: number }[]>(countQuery, countParams)
        setTotalItems(countResult[0]?.count || 0)

        // ページネーション用のLIMITとOFFSETを追加
        const offset = (currentPage - 1) * ITEMS_PER_PAGE
        entryQuery += ` LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`
      } else {
        setTotalItems(0) // タグフィルタリング・検索していない時はページネーションなし
      }

      let loadedEntries = await database.select<Entry[]>(entryQuery, entryParams)

      // 各エントリーのタグを取得
      for (const entry of loadedEntries) {
        entry.tags = await getTagsForEntry(database, entry.id)
      }

      // 返信の取得とフィルタリング
      let replies: Reply[] = []

      if (selectedTags.length > 0 || isSearching) {
        // タグフィルタまたは検索が有効な場合：返信もフィルタリング
        let replyQuery = 'SELECT id, entry_id, content, timestamp, archived FROM replies WHERE 1=1'
        const replyParams: (string | number)[] = []

        if (replyTagFilter.condition) {
          replyQuery += ` AND ${replyTagFilter.condition}`
          replyParams.push(...replyTagFilter.params)
        }

        // 検索条件を追加
        if (isSearching) {
          replyQuery += ' AND content LIKE ?'
          replyParams.push(`%${searchText.trim()}%`)
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
          // タグフィルタリングまたは検索時は日付条件なしで親エントリーを取得
          let additionalParentsQuery = `SELECT id, content, timestamp, pinned, archived, claude_session_id, claude_cwd, claude_project_path FROM entries WHERE id IN (${additionalParentIds.join(',')})`
          const additionalParentsParams: (string | number)[] = []

          if (!isCrossDateQuery) {
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
          `SELECT id, entry_id, content, timestamp, archived FROM replies WHERE entry_id IN (${entryIds.join(',')})`,
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
          pinned: entry.pinned === 1,
          archived: entry.archived === 1,
          claudeSessionId: entry.claude_session_id,
          claudeCwd: entry.claude_cwd,
          claudeProjectPath: entry.claude_project_path
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
          replyArchived: reply.archived === 1,
          parentEntry: parentEntry ? {
            id: parentEntry.id,
            content: parentEntry.content,
            archived: parentEntry.archived === 1,
            claudeSessionId: parentEntry.claude_session_id,
            claudeCwd: parentEntry.claude_cwd,
            claudeProjectPath: parentEntry.claude_project_path
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

  const handleScrollToEntry = async (entryId: number) => {
    const element = document.getElementById(`item-entry-${entryId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // ハイライト表示
      element.classList.add('highlight-flash')
      setTimeout(() => {
        element.classList.remove('highlight-flash')
      }, 2000)
    } else if (database && onDateChange) {
      // エントリーが現在のタイムラインにない場合、そのエントリーの日付に移動
      try {
        const result = await database.select<{ timestamp: string }[]>(
          'SELECT timestamp FROM entries WHERE id = ?',
          [entryId]
        )
        if (result.length > 0) {
          const entryDate = new Date(result[0].timestamp)
          onDateChange(entryDate)
          // 日付変更後に要素へスクロール（少し待ってDOMが更新されるのを待つ）
          setTimeout(() => {
            const el = document.getElementById(`item-entry-${entryId}`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el.classList.add('highlight-flash')
              setTimeout(() => {
                el.classList.remove('highlight-flash')
              }, 2000)
            }
          }, 300)
        }
      } catch (error) {
        console.error('エントリーの日付取得に失敗しました:', error)
      }
    }
  }

  const handleScrollToReply = async (replyId: number) => {
    const element = document.getElementById(`item-reply-${replyId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // ハイライト表示
      element.classList.add('highlight-flash')
      setTimeout(() => {
        element.classList.remove('highlight-flash')
      }, 2000)
    } else if (database && onDateChange) {
      // 返信が現在のタイムラインにない場合、その返信の日付に移動
      try {
        const result = await database.select<{ timestamp: string }[]>(
          'SELECT timestamp FROM replies WHERE id = ?',
          [replyId]
        )
        if (result.length > 0) {
          const entryDate = new Date(result[0].timestamp)
          onDateChange(entryDate)
          // 日付変更後にスクロール
          setTimeout(() => {
            const el = document.getElementById(`item-reply-${replyId}`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el.classList.add('highlight-flash')
              setTimeout(() => {
                el.classList.remove('highlight-flash')
              }, 2000)
            }
          }, 300)
        }
      } catch (error) {
        console.error('返信の日付取得に失敗しました:', error)
      }
    }
  }

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

  return {
    timelineItems,
    setTimelineItems,
    loadEntries,
    handleScrollToEntry,
    handleScrollToReply,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage: ITEMS_PER_PAGE,
  }
}
