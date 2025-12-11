/**
 * チェックボックスのステータス型
 * ' ' = 未完了, '/' = DOING, 'x' = 完了, '-' = キャンセル
 */
export type CheckboxStatus = ' ' | '/' | 'x' | 'X' | '-'

/** チェックボックスのパターン（未完了 + DOING のみ） */
export const CHECKBOX_PATTERN_INCOMPLETE = /^(\s*[-*+]\s+)\[([ /])\](.*)$/

/** チェックボックスのパターン（全ステータス） */
export const CHECKBOX_PATTERN_ALL = /^(\s*[-*+]\s+)\[([ /xX\-])\](.*)$/

/** org-mode形式のCLOSED行パターン */
export const CLOSED_TIMESTAMP_PATTERN = /^\s*CLOSED:\s*\[([^\]]+)\]/

/** DOING状態のパターン */
export const CHECKBOX_PATTERN_DOING = /^(\s*[-*+]\s+)\[\/\](.*)$/

/** キャンセル状態のパターン */
export const CHECKBOX_PATTERN_CANCELLED = /^(\s*[-*+]\s+)\[\-\](.*)$/

/**
 * チェックボックスの次のステータスを取得
 * ' ' -> '/' -> 'x' -> '-' -> ' ' のサイクル
 */
export function getNextCheckboxStatus(current: CheckboxStatus): CheckboxStatus {
  switch (current) {
    case ' ':
      return '/'
    case '/':
      return 'x'
    case 'x':
    case 'X':
      return '-'
    case '-':
    default:
      return ' '
  }
}

/**
 * 行のチェックボックスステータスを更新
 */
export function updateLineCheckboxStatus(
  line: string,
  newStatus: CheckboxStatus
): string | null {
  const match = line.match(CHECKBOX_PATTERN_ALL)
  if (match) {
    return `${match[1]}[${newStatus}]${match[3]}`
  }
  return null
}

/**
 * org-mode形式の日付文字列を生成
 * 例: [2025-12-06 Fri 14:30]
 */
export function formatOrgModeTimestamp(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dayName = days[date.getDay()]
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `[${year}-${month}-${day} ${dayName} ${hours}:${minutes}]`
}

/**
 * org-mode形式のCLOSED行を生成
 */
export function createClosedLine(indent: string = '  '): string {
  const timestamp = formatOrgModeTimestamp(new Date())
  return `${indent}CLOSED: ${timestamp}`
}

/**
 * CLOSED行から完了時刻を抽出してDateオブジェクトに変換
 */
export function parseClosedTimestamp(line: string): Date | null {
  const match = line.match(CLOSED_TIMESTAMP_PATTERN)
  if (match) {
    // [2025-12-06 Fri 14:30] -> 2025-12-06T14:30
    const dateStr = match[1]
    // 日付部分と時刻部分を抽出
    const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})\s+\w+\s+(\d{2}:\d{2})/)
    if (dateMatch) {
      return new Date(`${dateMatch[1]}T${dateMatch[2]}`)
    }
  }
  return null
}

/**
 * CLOSED行かどうかを判定
 */
export function isClosedLine(line: string): boolean {
  return CLOSED_TIMESTAMP_PATTERN.test(line)
}

/**
 * コンテンツにタスク行（チェックボックス）が含まれているかを判定
 */
export function hasTaskLine(content: string): boolean {
  const lines = content.split('\n')
  return lines.some(line => CHECKBOX_PATTERN_ALL.test(line))
}
