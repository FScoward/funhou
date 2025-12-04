/**
 * チェックボックスのステータス型
 * ' ' = 未完了, '/' = DOING, 'x' = 完了, '-' = キャンセル
 */
export type CheckboxStatus = ' ' | '/' | 'x' | 'X' | '-'

/** チェックボックスのパターン（未完了 + DOING のみ） */
export const CHECKBOX_PATTERN_INCOMPLETE = /^(\s*[-*+]\s+)\[([ /])\](.*)$/

/** チェックボックスのパターン（全ステータス） */
export const CHECKBOX_PATTERN_ALL = /^(\s*[-*+]\s+)\[([ /xX\-])\](.*)$/

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
