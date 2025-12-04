import { CHECKBOX_PATTERN_ALL } from './checkboxUtils'

/**
 * 行がすでにタスク形式かどうかを判定
 */
export function isTaskLine(line: string): boolean {
  return CHECKBOX_PATTERN_ALL.test(line)
}

/**
 * 単一行をタスク形式に変換
 * - すでにタスク形式の場合: そのまま返す
 * - 空行/空白のみの場合: そのまま返す
 * - 既存のリストマーカー（-, *, +）がある場合: チェックボックスを追加
 * - それ以外: `- [ ] ` を先頭に追加（インデント保持）
 */
export function convertLineToTask(line: string): string {
  // 空行または空白のみ
  if (line.trim() === '') {
    return line
  }

  // すでにタスク形式
  if (isTaskLine(line)) {
    return line
  }

  // 既存のリストマーカーがある場合（インデント考慮）
  const listPattern = /^(\s*)([-*+])\s+(.*)$/
  const listMatch = line.match(listPattern)
  if (listMatch) {
    const [, indent, , content] = listMatch
    return `${indent}- [ ] ${content}`
  }

  // インデントを保持して変換
  const indentMatch = line.match(/^(\s*)(.*)$/)
  if (indentMatch) {
    const [, indent, content] = indentMatch
    return `${indent}- [ ] ${content}`
  }

  return `- [ ] ${line}`
}

/**
 * 複数行をタスク形式に変換
 */
export function convertLinesToTasks(lines: string[]): string[] {
  return lines.map(convertLineToTask)
}

/**
 * テキストの選択範囲をタスクに変換
 * @param fullText 全テキスト
 * @param selectionStart 選択開始位置
 * @param selectionEnd 選択終了位置
 * @returns 変換後の全テキストと新しい選択範囲
 */
export function convertSelectionToTasks(
  fullText: string,
  selectionStart: number,
  selectionEnd: number
): { text: string; newSelectionStart: number; newSelectionEnd: number } {
  // 選択範囲を含む行の範囲を特定
  const beforeSelection = fullText.substring(0, selectionStart)
  const lineStartIndex = beforeSelection.lastIndexOf('\n') + 1

  const afterSelection = fullText.substring(selectionEnd)
  const lineEndOffset = afterSelection.indexOf('\n')
  const lineEndIndex =
    lineEndOffset === -1 ? fullText.length : selectionEnd + lineEndOffset

  // 変換対象の行を抽出
  const targetText = fullText.substring(lineStartIndex, lineEndIndex)
  const lines = targetText.split('\n')

  // 各行を変換
  const convertedLines = convertLinesToTasks(lines)
  const convertedText = convertedLines.join('\n')

  // 新しいテキストを構築
  const newText =
    fullText.substring(0, lineStartIndex) +
    convertedText +
    fullText.substring(lineEndIndex)

  // 新しい選択範囲を計算（変換後のテキスト全体を選択）
  const newSelectionStart = lineStartIndex
  const newSelectionEnd = lineStartIndex + convertedText.length

  return {
    text: newText,
    newSelectionStart,
    newSelectionEnd,
  }
}
