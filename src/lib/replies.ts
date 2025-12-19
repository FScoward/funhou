import Database from '@tauri-apps/plugin-sql'
import { Reply } from '@/types'
import { getTagsForReply } from '@/lib/tags'

/**
 * 返信をIDで取得する
 * @param db データベース接続
 * @param replyId 返信ID
 * @returns 返信データ（タグ付き）、見つからない場合はnull
 */
export async function getReplyById(
  db: Database,
  replyId: number
): Promise<Reply | null> {
  const results = await db.select<Reply[]>(
    'SELECT id, entry_id, content, timestamp, archived FROM replies WHERE id = ?',
    [replyId]
  )

  if (results.length === 0) {
    return null
  }

  const reply = results[0]

  // タグを取得
  reply.tags = await getTagsForReply(db, replyId)

  return reply
}

/**
 * エントリIDに紐づく返信一覧を取得する
 * @param db データベース接続
 * @param entryId エントリID
 * @returns 返信データの配列（タグ付き）
 */
export async function getRepliesByEntryId(
  db: Database,
  entryId: number
): Promise<Reply[]> {
  const results = await db.select<Reply[]>(
    'SELECT id, entry_id, content, timestamp, archived FROM replies WHERE entry_id = ? ORDER BY timestamp ASC',
    [entryId]
  )

  // 各返信にタグを取得
  for (const reply of results) {
    reply.tags = await getTagsForReply(db, reply.id)
  }

  return results
}
