import { TimelineItem } from '@/types'
import { formatDateToLocalYYYYMMDD } from './dateUtils'

export interface GroupedTimelineItems {
  date: string
  displayDate: string
  items: TimelineItem[]
}

/**
 * タイムラインアイテムを日付別にグループ化する
 * @param items タイムラインアイテムの配列
 * @returns 日付別にグループ化されたアイテム
 */
export function groupTimelineItemsByDate(items: TimelineItem[]): GroupedTimelineItems[] {
  const grouped = new Map<string, TimelineItem[]>()

  // 各アイテムを日付ごとに分類
  items.forEach((item) => {
    const date = new Date(item.timestamp)
    const dateKey = formatDateToLocalYYYYMMDD(date)

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(item)
  })

  // Map を配列に変換し、日付の降順でソート
  const result: GroupedTimelineItems[] = Array.from(grouped.entries())
    .map(([date, items]) => {
      // 各グループ内でピン留め優先、その後時系列順にソート
      const sortedItems = [...items].sort((a, b) => {
        const aPinned = a.type === 'entry' && a.pinned ? 1 : 0
        const bPinned = b.type === 'entry' && b.pinned ? 1 : 0

        if (aPinned !== bPinned) {
          return bPinned - aPinned
        }

        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      return {
        date,
        displayDate: formatDisplayDate(date),
        items: sortedItems,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date)) // 日付の降順

  return result
}

/**
 * 日付文字列を表示用にフォーマット
 * @param dateStr YYYY-MM-DD形式の日付文字列
 * @returns 表示用の日付文字列（例: 2024年1月15日（月））
 */
function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdays[date.getDay()]

  return `${year}年${month}月${day}日（${weekday}）`
}
