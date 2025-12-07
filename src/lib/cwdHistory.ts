import Database from '@tauri-apps/plugin-sql'

export interface CwdHistoryItem {
  cwd: string
  usageCount: number
  lastUsed: string
}

/**
 * cwdの使用を記録する
 * cwd_historyテーブルにINSERT or UPDATE
 */
export async function recordCwdUsage(db: Database, cwd: string): Promise<void> {
  if (!cwd || cwd.trim() === '') return

  try {
    await db.execute(
      `INSERT INTO cwd_history (cwd, usage_count, last_used)
       VALUES (?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(cwd) DO UPDATE SET
         usage_count = usage_count + 1,
         last_used = CURRENT_TIMESTAMP`,
      [cwd.trim()]
    )
  } catch (error) {
    console.error('cwd履歴の記録に失敗しました:', error)
  }
}

/**
 * entriesテーブルとcwd_historyテーブルからclaude_cwdの履歴を取得
 * 両方のテーブルからマージして使用回数でソート
 */
export async function getCwdHistory(db: Database): Promise<CwdHistoryItem[]> {
  try {
    // entriesテーブルとcwd_historyテーブルの両方から取得してマージ
    const result = await db.select<Array<{
      cwd: string
      usage_count: number
      last_used: string
    }>>(
      `SELECT cwd, SUM(usage_count) as usage_count, MAX(last_used) as last_used
       FROM (
         -- entriesテーブルからの履歴
         SELECT
           claude_cwd as cwd,
           COUNT(*) as usage_count,
           MAX(timestamp) as last_used
         FROM entries
         WHERE claude_cwd IS NOT NULL AND claude_cwd != ''
         GROUP BY claude_cwd

         UNION ALL

         -- cwd_historyテーブルからの履歴
         SELECT
           cwd,
           usage_count,
           last_used
         FROM cwd_history
         WHERE cwd IS NOT NULL AND cwd != ''
       )
       GROUP BY cwd
       ORDER BY usage_count DESC, last_used DESC
       LIMIT 20`
    )

    return result.map((row) => ({
      cwd: row.cwd,
      usageCount: row.usage_count,
      lastUsed: row.last_used,
    }))
  } catch (error) {
    console.error('cwd履歴の取得に失敗しました:', error)
    return []
  }
}
