import Database from '@tauri-apps/plugin-sql'
import { associateTagsWithEntry } from '@/lib/tags'
import { CHECKBOX_PATTERN_ALL, type CheckboxStatus } from './checkboxUtils'

/**
 * ステータスの日本語ラベルを取得する
 */
export function getStatusLabel(status: CheckboxStatus): string {
  switch (status) {
    case ' ':
      return '未完了'
    case '/':
      return 'DOING'
    case 'x':
    case 'X':
      return '完了'
    case '-':
      return 'キャンセル'
    default:
      return status
  }
}

export interface LogStatusChangeParams {
  db: Database
  taskText: string
  oldStatus: CheckboxStatus
  newStatus: CheckboxStatus
  tagNames: string[]
}

/**
 * ステータス変更をエントリとして記録する
 * @returns 作成されたエントリのID、失敗した場合はnull
 */
export async function logStatusChange({
  db,
  taskText,
  oldStatus,
  newStatus,
  tagNames,
}: LogStatusChangeParams): Promise<number | null> {
  try {
    const timestamp = new Date().toISOString()
    const oldLabel = getStatusLabel(oldStatus)
    const newLabel = getStatusLabel(newStatus)

    // 記録エントリのコンテンツ
    const content = `${taskText} を ${oldLabel} から ${newLabel} に変更`

    // エントリを作成
    const result = await db.execute(
      'INSERT INTO entries (content, timestamp) VALUES (?, ?)',
      [content, timestamp]
    )

    const entryId = Number(result.lastInsertId)

    // タグを関連付け
    if (tagNames.length > 0) {
      await associateTagsWithEntry(db, entryId, tagNames)
    }

    return entryId
  } catch (error) {
    console.error('ステータス変更の記録に失敗しました:', error)
    return null
  }
}

export interface StatusChange {
  lineIndex: number
  taskText: string
  oldStatus: CheckboxStatus
  newStatus: CheckboxStatus
}

/**
 * 2つのコンテンツを比較してステータス変更を検出する
 */
export function detectStatusChanges(oldContent: string, newContent: string): StatusChange[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const changes: StatusChange[] = []

  // 各行を比較してステータス変更を検出
  // 行数が異なる場合（CLOSED行の追加/削除）も考慮
  let oldLineIdx = 0
  let newLineIdx = 0

  while (oldLineIdx < oldLines.length && newLineIdx < newLines.length) {
    const oldLine = oldLines[oldLineIdx]
    const newLine = newLines[newLineIdx]

    const oldMatch = oldLine.match(CHECKBOX_PATTERN_ALL)
    const newMatch = newLine.match(CHECKBOX_PATTERN_ALL)

    if (oldMatch && newMatch) {
      const oldStatus = oldMatch[2] as CheckboxStatus
      const newStatus = newMatch[2] as CheckboxStatus
      const oldText = oldMatch[3].trim()
      const newText = newMatch[3].trim()

      // 同じタスクでステータスが変わった場合
      if (oldText === newText && oldStatus !== newStatus) {
        changes.push({
          lineIndex: oldLineIdx + 1,
          taskText: oldText,
          oldStatus,
          newStatus,
        })
      }
    }

    oldLineIdx++
    newLineIdx++

    // CLOSED行をスキップ（追加/削除された場合のズレを調整）
    while (oldLineIdx < oldLines.length && oldLines[oldLineIdx].trim().startsWith('CLOSED:')) {
      oldLineIdx++
    }
    while (newLineIdx < newLines.length && newLines[newLineIdx].trim().startsWith('CLOSED:')) {
      newLineIdx++
    }
  }

  return changes
}
