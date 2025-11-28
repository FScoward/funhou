import Database from '@tauri-apps/plugin-sql'
import type { Tag, CategorizedTags } from '../types'

export type { Tag, CategorizedTags }

/**
 * コンテンツから#で始まるタグを抽出する
 * @param content エントリーのコンテンツ
 * @returns 抽出されたタグ名の配列（重複なし）
 */
export function extractTagsFromContent(content: string): string[] {
  // #で始まる単語を抽出（#の後に空白以外の文字が続くパターン）
  const tagPattern = /#[^\s#]+/g
  const matches = content.match(tagPattern)

  if (!matches) return []

  // #を除去し、重複を削除
  const tags = matches.map(tag => tag.slice(1))
  return Array.from(new Set(tags))
}

/**
 * タグを保存する（既に存在する場合は既存のIDを返す）
 * @param db データベースインスタンス
 * @param tagName タグ名
 * @returns タグのID
 */
export async function saveTag(db: Database, tagName: string): Promise<number> {
  // 既存のタグを検索
  const existing = await db.select<Tag[]>(
    'SELECT id, name FROM tags WHERE name = ?',
    [tagName]
  )

  if (existing.length > 0) {
    return existing[0].id
  }

  // 新規タグを挿入
  const result = await db.execute(
    'INSERT INTO tags (name) VALUES (?)',
    [tagName]
  )

  return Number(result.lastInsertId)
}

/**
 * エントリーにタグを関連付ける
 * @param db データベースインスタンス
 * @param entryId エントリーID
 * @param tagNames タグ名の配列
 */
export async function associateTagsWithEntry(
  db: Database,
  entryId: number,
  tagNames: string[]
): Promise<void> {
  // 既存の関連のタグIDを取得（usage_count更新用）
  const existingTags = await db.select<{ tag_id: number }[]>(
    'SELECT tag_id FROM entry_tags WHERE entry_id = ?',
    [entryId]
  )
  const existingTagIds = new Set(existingTags.map(t => t.tag_id))

  // 既存の関連を削除
  await db.execute('DELETE FROM entry_tags WHERE entry_id = ?', [entryId])

  // 削除されたタグのusage_countを減らす
  for (const tagId of existingTagIds) {
    await db.execute(
      'UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?',
      [tagId]
    )
  }

  // 新しい関連を作成
  for (const tagName of tagNames) {
    const tagId = await saveTag(db, tagName)
    await db.execute(
      'INSERT INTO entry_tags (entry_id, tag_id) VALUES (?, ?)',
      [entryId, tagId]
    )
    // usage_countを増やしてlast_used_atを更新
    await updateTagUsage(db, tagId)
  }
}

/**
 * エントリーのタグを取得する
 * @param db データベースインスタンス
 * @param entryId エントリーID
 * @returns タグの配列
 */
export async function getTagsForEntry(db: Database, entryId: number): Promise<Tag[]> {
  const tags = await db.select<Tag[]>(
    `SELECT t.id, t.name
     FROM tags t
     INNER JOIN entry_tags et ON t.id = et.tag_id
     WHERE et.entry_id = ?
     ORDER BY t.name`,
    [entryId]
  )

  return tags
}

/**
 * すべてのタグを取得する（統計情報付き）
 * @param db データベースインスタンス
 * @returns タグの配列（usageCount, lastUsedAt付き）
 */
export async function getAllTags(db: Database): Promise<Tag[]> {
  const tags = await db.select<Tag[]>(
    'SELECT id, name, usage_count as usageCount, last_used_at as lastUsedAt FROM tags ORDER BY name'
  )

  return tags
}

/**
 * 使用頻度の高いタグを取得する
 * @param db データベースインスタンス
 * @param limit 取得件数（デフォルト: 5）
 * @returns 使用頻度順にソートされたタグの配列
 */
export async function getFrequentTags(db: Database, limit: number = 5): Promise<Tag[]> {
  const tags = await db.select<Tag[]>(
    `SELECT id, name, usage_count as usageCount, last_used_at as lastUsedAt
     FROM tags
     WHERE usage_count > 0
     ORDER BY usage_count DESC, name ASC
     LIMIT ?`,
    [limit]
  )

  return tags
}

/**
 * 最近使用したタグを取得する
 * @param db データベースインスタンス
 * @param limit 取得件数（デフォルト: 5）
 * @returns 最近使用された順にソートされたタグの配列
 */
export async function getRecentTags(db: Database, limit: number = 5): Promise<Tag[]> {
  const tags = await db.select<Tag[]>(
    `SELECT id, name, usage_count as usageCount, last_used_at as lastUsedAt
     FROM tags
     WHERE last_used_at IS NOT NULL
     ORDER BY last_used_at DESC
     LIMIT ?`,
    [limit]
  )

  return tags
}

/**
 * タグの使用統計を更新する
 * @param db データベースインスタンス
 * @param tagId タグID
 */
export async function updateTagUsage(db: Database, tagId: number): Promise<void> {
  await db.execute(
    `UPDATE tags
     SET usage_count = usage_count + 1,
         last_used_at = datetime('now')
     WHERE id = ?`,
    [tagId]
  )
}

/**
 * タグをカテゴリ分けする（純粋関数）
 * @param tags 全タグの配列
 * @param limit カテゴリごとの表示件数（デフォルト: 5）
 * @returns カテゴリ分けされたタグ
 */
export function categorizeTagsByUsage(tags: Tag[], limit: number = 5): CategorizedTags {
  // 使用頻度が高いタグ（usage_count > 0 のもの、上位limit件）
  const frequentTags = [...tags]
    .filter(tag => (tag.usageCount ?? 0) > 0)
    .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
    .slice(0, limit)

  // 最近使用したタグ（lastUsedAtがあるもの、上位limit件）
  const recentTags = [...tags]
    .filter(tag => tag.lastUsedAt != null)
    .sort((a, b) => {
      const dateA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0
      const dateB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0
      return dateB - dateA
    })
    .slice(0, limit)

  // frequentとrecentに含まれないタグ
  const frequentIds = new Set(frequentTags.map(t => t.id))
  const recentIds = new Set(recentTags.map(t => t.id))
  const others = tags.filter(tag => !frequentIds.has(tag.id) && !recentIds.has(tag.id))

  return { frequent: frequentTags, recent: recentTags, others }
}

/**
 * タグを削除する
 * @param db データベースインスタンス
 * @param tagName タグ名
 */
export async function deleteTag(db: Database, tagName: string): Promise<void> {
  await db.execute('DELETE FROM tags WHERE name = ?', [tagName])
}

/**
 * 返信にタグを関連付ける
 * @param db データベースインスタンス
 * @param replyId 返信ID
 * @param tagNames タグ名の配列
 */
export async function associateTagsWithReply(
  db: Database,
  replyId: number,
  tagNames: string[]
): Promise<void> {
  // 既存の関連のタグIDを取得（usage_count更新用）
  const existingTags = await db.select<{ tag_id: number }[]>(
    'SELECT tag_id FROM reply_tags WHERE reply_id = ?',
    [replyId]
  )
  const existingTagIds = new Set(existingTags.map(t => t.tag_id))

  // 既存の関連を削除
  await db.execute('DELETE FROM reply_tags WHERE reply_id = ?', [replyId])

  // 削除されたタグのusage_countを減らす
  for (const tagId of existingTagIds) {
    await db.execute(
      'UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?',
      [tagId]
    )
  }

  // 新しい関連を作成
  for (const tagName of tagNames) {
    const tagId = await saveTag(db, tagName)
    await db.execute(
      'INSERT INTO reply_tags (reply_id, tag_id) VALUES (?, ?)',
      [replyId, tagId]
    )
    // usage_countを増やしてlast_used_atを更新
    await updateTagUsage(db, tagId)
  }
}

/**
 * 返信のタグを取得する
 * @param db データベースインスタンス
 * @param replyId 返信ID
 * @returns タグの配列
 */
export async function getTagsForReply(db: Database, replyId: number): Promise<Tag[]> {
  const tags = await db.select<Tag[]>(
    `SELECT t.id, t.name
     FROM tags t
     INNER JOIN reply_tags rt ON t.id = rt.tag_id
     WHERE rt.reply_id = ?
     ORDER BY t.name`,
    [replyId]
  )

  return tags
}

/**
 * タグ名でエントリーをフィルタリングするためのSQL条件を構築する
 * @param tagNames タグ名の配列
 * @param filterMode 'AND' または 'OR'
 * @returns SQL WHERE句の一部
 */
export function buildTagFilterCondition(
  tagNames: string[],
  filterMode: 'AND' | 'OR'
): { condition: string; params: string[] } {
  if (tagNames.length === 0) {
    return { condition: '', params: [] }
  }

  if (filterMode === 'OR') {
    // いずれかのタグを持つエントリー
    const placeholders = tagNames.map(() => '?').join(', ')
    return {
      condition: `id IN (
        SELECT DISTINCT et.entry_id
        FROM entry_tags et
        INNER JOIN tags t ON et.tag_id = t.id
        WHERE t.name IN (${placeholders})
      )`,
      params: tagNames
    }
  } else {
    // すべてのタグを持つエントリー
    const placeholders = tagNames.map(() => '?').join(', ')
    return {
      condition: `id IN (
        SELECT et.entry_id
        FROM entry_tags et
        INNER JOIN tags t ON et.tag_id = t.id
        WHERE t.name IN (${placeholders})
        GROUP BY et.entry_id
        HAVING COUNT(DISTINCT t.name) = ${tagNames.length}
      )`,
      params: tagNames
    }
  }
}

/**
 * タグ名で返信をフィルタリングするためのSQL条件を構築する
 * @param tagNames タグ名の配列
 * @param filterMode 'AND' または 'OR'
 * @returns SQL WHERE句の一部
 */
export function buildReplyTagFilterCondition(
  tagNames: string[],
  filterMode: 'AND' | 'OR'
): { condition: string; params: string[] } {
  if (tagNames.length === 0) {
    return { condition: '', params: [] }
  }

  if (filterMode === 'OR') {
    // いずれかのタグを持つ返信
    const placeholders = tagNames.map(() => '?').join(', ')
    return {
      condition: `id IN (
        SELECT DISTINCT rt.reply_id
        FROM reply_tags rt
        INNER JOIN tags t ON rt.tag_id = t.id
        WHERE t.name IN (${placeholders})
      )`,
      params: tagNames
    }
  } else {
    // すべてのタグを持つ返信
    const placeholders = tagNames.map(() => '?').join(', ')
    return {
      condition: `id IN (
        SELECT rt.reply_id
        FROM reply_tags rt
        INNER JOIN tags t ON rt.tag_id = t.id
        WHERE t.name IN (${placeholders})
        GROUP BY rt.reply_id
        HAVING COUNT(DISTINCT t.name) = ${tagNames.length}
      )`,
      params: tagNames
    }
  }
}
