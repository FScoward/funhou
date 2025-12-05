import Database from '@tauri-apps/plugin-sql'

export interface CwdHistoryItem {
  cwd: string
  usageCount: number
  lastUsed: string
}

/**
 * entriesテーブルからclaude_cwdの履歴を取得
 * 使用回数でソート
 */
export async function getCwdHistory(db: Database): Promise<CwdHistoryItem[]> {
  try {
    const result = await db.select<Array<{
      claude_cwd: string
      usage_count: number
      last_used: string
    }>>(
      `SELECT
        claude_cwd,
        COUNT(*) as usage_count,
        MAX(timestamp) as last_used
      FROM entries
      WHERE claude_cwd IS NOT NULL AND claude_cwd != ''
      GROUP BY claude_cwd
      ORDER BY usage_count DESC, last_used DESC
      LIMIT 20`
    )

    return result.map((row) => ({
      cwd: row.claude_cwd,
      usageCount: row.usage_count,
      lastUsed: row.last_used,
    }))
  } catch (error) {
    console.error('cwd履歴の取得に失敗しました:', error)
    return []
  }
}
