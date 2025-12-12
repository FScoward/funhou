/**
 * Gemini Live用エントリーコンテキスト管理
 * - エントリー情報をGemini用プロンプトに変換
 * - 直近のエントリーを選択してコンテキストに含める
 */

import type { TimelineItem, Tag } from '@/types'

/**
 * Geminiに渡すエントリーコンテキスト
 */
export interface EntryContext {
  id: number
  content: string
  timestamp: string
  tags: string[]
  /** 相対時間表現（「今日」「昨日」「3時間前」など） */
  relativeTime: string
  /** コンテキスト内での番号（1から始まる） */
  index: number
}

/**
 * 相対時間を計算して日本語で表現
 */
function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const entryTime = new Date(timestamp)
  const diffMs = now.getTime() - entryTime.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // 同じ日かどうかを確認
  const isToday = now.toDateString() === entryTime.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = yesterday.toDateString() === entryTime.toDateString()

  if (diffMinutes < 1) {
    return 'たった今'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分前`
  } else if (isToday) {
    return `今日 ${diffHours}時間前`
  } else if (isYesterday) {
    return '昨日'
  } else if (diffDays < 7) {
    return `${diffDays}日前`
  } else {
    return entryTime.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
    })
  }
}

/**
 * TimelineItemをEntryContextに変換
 */
function toEntryContext(
  item: TimelineItem,
  index: number
): EntryContext | null {
  // エントリーのみ対象
  if (item.type !== 'entry') {
    return null
  }

  return {
    id: item.id,
    content: item.content,
    timestamp: item.timestamp,
    tags: item.tags?.map((tag: Tag) => tag.name) || [],
    relativeTime: getRelativeTime(item.timestamp),
    index: index + 1, // 1から始まる番号
  }
}

export interface SelectEntriesOptions {
  /** 最大件数（デフォルト: 10） */
  maxCount?: number
  /** 何時間前までを含めるか（デフォルト: 24） */
  hoursBack?: number
  /** サマリーモード（長いエントリーを短縮） */
  summaryMode?: boolean
}

/**
 * コンテキストに含めるエントリーを選択
 * - 直近の指定時間以内のエントリーを最大maxCount件選択
 */
export function selectEntriesForContext(
  items: TimelineItem[],
  options: SelectEntriesOptions = {}
): EntryContext[] {
  const { maxCount = 10, hoursBack = 24 } = options

  const now = new Date()
  const cutoffTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)

  // エントリーのみをフィルタリングして変換
  const entries: EntryContext[] = []
  let index = 0

  for (const item of items) {
    if (item.type !== 'entry') continue

    const entryTime = new Date(item.timestamp)
    if (entryTime < cutoffTime) continue

    const context = toEntryContext(item, index)
    if (context) {
      entries.push(context)
      index++
    }

    if (entries.length >= maxCount) break
  }

  return entries
}

/**
 * エントリーコンテキストをプロンプト用テキストに変換
 */
export function buildEntryContextPrompt(entries: EntryContext[]): string {
  if (entries.length === 0) {
    return '（参照可能なエントリーはありません）'
  }

  const lines = entries.map((entry) => {
    const tagsStr =
      entry.tags.length > 0 ? ` [${entry.tags.map((t) => `#${t}`).join(' ')}]` : ''
    // 長いコンテンツは最初の100文字に短縮
    const shortContent =
      entry.content.length > 100
        ? entry.content.substring(0, 100) + '...'
        : entry.content
    // 改行を空白に置換して1行に
    const singleLineContent = shortContent.replace(/\n/g, ' ')

    return `${entry.index}. [${entry.relativeTime}]${tagsStr} ${singleLineContent}`
  })

  return lines.join('\n')
}

/**
 * エントリー参照付きのシステムプロンプトを構築
 */
export function buildSystemPromptWithEntries(
  basePrompt: string | undefined,
  entries: EntryContext[]
): string {
  const entryContextPrompt = buildEntryContextPrompt(entries)

  const defaultInstructions = `あなたは分報アプリのアシスタントです。ユーザーのエントリーについて対話し、
内容を深掘りしたり整理したりする手伝いをします。

## 参照可能なエントリー
${entryContextPrompt}

## 指示
- ユーザーが「今日のエントリー」「さっきの投稿」「1番目のエントリー」などと言った場合、該当するエントリーを特定して内容について対話してください
- 対話の結果を保存したい場合は「保存する」「新しいエントリーにして」などと言ってもらってください
- 保存時は要約や整理された形式で提案してください
- 日本語で応答してください`

  // ベースプロンプトがある場合は追加
  if (basePrompt && basePrompt.trim()) {
    return `${basePrompt}\n\n${defaultInstructions}`
  }

  return defaultInstructions
}

/**
 * 対話内容から保存すべきサマリーを抽出するためのヘルパー
 * Geminiの応答から「まとめ」「整理結果」などを検出
 */
export function extractSummaryFromMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): string | null {
  // 最後のアシスタントメッセージを取得
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant')

  if (!lastAssistantMessage) {
    return null
  }

  return lastAssistantMessage.content
}

/**
 * 保存リクエストを検出
 * 「保存して」「エントリーにして」「まとめて保存」などのキーワードを検出
 */
export function detectSaveIntent(text: string): boolean {
  const saveKeywords = [
    '保存',
    'ほぞん',
    'エントリーにして',
    'エントリーに',
    '記録して',
    'きろくして',
    'まとめて',
  ]

  const lowerText = text.toLowerCase()
  return saveKeywords.some((keyword) => lowerText.includes(keyword))
}
