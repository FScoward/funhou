import Database from '@tauri-apps/plugin-sql'

export interface Tag {
  id: number
  name: string
}

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
  // 既存の関連を削除
  await db.execute('DELETE FROM entry_tags WHERE entry_id = ?', [entryId])

  // 新しい関連を作成
  for (const tagName of tagNames) {
    const tagId = await saveTag(db, tagName)
    await db.execute(
      'INSERT INTO entry_tags (entry_id, tag_id) VALUES (?, ?)',
      [entryId, tagId]
    )
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
 * すべてのタグを取得する
 * @param db データベースインスタンス
 * @returns タグの配列
 */
export async function getAllTags(db: Database): Promise<Tag[]> {
  const tags = await db.select<Tag[]>(
    'SELECT id, name FROM tags ORDER BY name'
  )

  return tags
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
  // 既存の関連を削除
  await db.execute('DELETE FROM reply_tags WHERE reply_id = ?', [replyId])

  // 新しい関連を作成
  for (const tagName of tagNames) {
    const tagId = await saveTag(db, tagName)
    await db.execute(
      'INSERT INTO reply_tags (reply_id, tag_id) VALUES (?, ?)',
      [replyId, tagId]
    )
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
