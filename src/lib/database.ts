import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:funhou.db')

    // テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL
      )
    `)

    // 設定テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // デフォルト設定を挿入（既に存在しない場合のみ）
    await db.execute(`
      INSERT OR IGNORE INTO settings (key, value) VALUES ('always_on_top', 'false')
    `)
    await db.execute(`
      INSERT OR IGNORE INTO settings (key, value) VALUES ('autohide_enabled', 'false')
    `)
    await db.execute(`
      INSERT OR IGNORE INTO settings (key, value) VALUES ('autohide_edge', 'left')
    `)

    // 返信テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
      )
    `)

    // インデックス作成
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_replies_entry_id ON replies(entry_id)
    `)

    // タグテーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `)

    // エントリーとタグの中間テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS entry_tags (
        entry_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (entry_id, tag_id),
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `)

    // タグ検索用のインデックスを作成
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON entry_tags(entry_id)
    `)
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id)
    `)

    // 返信とタグの中間テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reply_tags (
        reply_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (reply_id, tag_id),
        FOREIGN KEY (reply_id) REFERENCES replies(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `)

    // 返信タグ検索用のインデックスを作成
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_reply_tags_reply_id ON reply_tags(reply_id)
    `)
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_reply_tags_tag_id ON reply_tags(tag_id)
    `)

    // pinnedカラムを追加（既に存在する場合はエラーを無視）
    try {
      await db.execute(`
        ALTER TABLE entries ADD COLUMN pinned INTEGER DEFAULT 0
      `)
    } catch (error) {
      // カラムが既に存在する場合はエラーを無視
      console.log('pinned column already exists or migration error:', error)
    }

    // タグ使用統計カラムを追加（既に存在する場合はエラーを無視）
    try {
      await db.execute(`
        ALTER TABLE tags ADD COLUMN usage_count INTEGER DEFAULT 0
      `)
    } catch (error) {
      console.log('usage_count column already exists or migration error:', error)
    }

    try {
      await db.execute(`
        ALTER TABLE tags ADD COLUMN last_used_at DATETIME DEFAULT NULL
      `)
    } catch (error) {
      console.log('last_used_at column already exists or migration error:', error)
    }

    // 既存データのマイグレーション: usage_countを集計して更新
    await db.execute(`
      UPDATE tags SET usage_count = (
        SELECT COUNT(*) FROM (
          SELECT tag_id FROM entry_tags WHERE tag_id = tags.id
          UNION ALL
          SELECT tag_id FROM reply_tags WHERE tag_id = tags.id
        )
      )
      WHERE usage_count = 0 OR usage_count IS NULL
    `)

    // 既存データのマイグレーション: last_used_atを集計して更新
    await db.execute(`
      UPDATE tags SET last_used_at = (
        SELECT MAX(timestamp) FROM (
          SELECT e.timestamp FROM entries e
          JOIN entry_tags et ON e.id = et.entry_id
          WHERE et.tag_id = tags.id
          UNION ALL
          SELECT r.timestamp FROM replies r
          JOIN reply_tags rt ON r.id = rt.reply_id
          WHERE rt.tag_id = tags.id
        )
      )
      WHERE last_used_at IS NULL
    `)

    // archivedカラムを追加（既に存在する場合はエラーを無視）
    try {
      await db.execute(`
        ALTER TABLE entries ADD COLUMN archived INTEGER DEFAULT 0
      `)
    } catch (error) {
      console.log('archived column already exists or migration error:', error)
    }

    // is_currentカラムを追加（「今何してる？」機能用）
    try {
      await db.execute(`
        ALTER TABLE entries ADD COLUMN is_current INTEGER DEFAULT 0
      `)
    } catch (error) {
      console.log('is_current column already exists or migration error:', error)
    }

    // 返信テーブルにarchivedカラムを追加（既に存在する場合はエラーを無視）
    try {
      await db.execute(`
        ALTER TABLE replies ADD COLUMN archived INTEGER DEFAULT 0
      `)
    } catch (error) {
      console.log('replies.archived column already exists or migration error:', error)
    }

    // DOINGタスクの並び順テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS doing_order (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        reply_id INTEGER,
        line_index INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        UNIQUE(entry_id, reply_id, line_index)
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_doing_order_sort ON doing_order(sort_order)
    `)

    // 未完了タスクの並び順テーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS incomplete_order (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        reply_id INTEGER,
        line_index INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        UNIQUE(entry_id, reply_id, line_index)
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_incomplete_order_sort ON incomplete_order(sort_order)
    `)

    // Claude Codeセッション紐付け用カラムを追加
    try {
      await db.execute(`
        ALTER TABLE entries ADD COLUMN claude_session_id TEXT DEFAULT NULL
      `)
    } catch (error) {
      console.log('claude_session_id column already exists or migration error:', error)
    }

    try {
      await db.execute(`
        ALTER TABLE entries ADD COLUMN claude_cwd TEXT DEFAULT NULL
      `)
    } catch (error) {
      console.log('claude_cwd column already exists or migration error:', error)
    }

    try {
      await db.execute(`
        ALTER TABLE entries ADD COLUMN claude_project_path TEXT DEFAULT NULL
      `)
    } catch (error) {
      console.log('claude_project_path column already exists or migration error:', error)
    }

    // タスクとClaude Codeセッションの紐付けテーブルを作成
    await db.execute(`
      CREATE TABLE IF NOT EXISTS task_claude_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        reply_id INTEGER,
        line_index INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        cwd TEXT NOT NULL,
        project_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(entry_id, reply_id, line_index, session_id)
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_task_claude_sessions_task
        ON task_claude_sessions(entry_id, reply_id, line_index)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_task_claude_sessions_session
        ON task_claude_sessions(session_id)
    `)
  }
  return db
}
