const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'persist/db/galeria.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

let db

// Columns added after the initial release. Each is applied via ALTER TABLE
// and ignored if it already exists, so this file stays the single source of
// truth for the schema without needing a separate migration runner.
const PHOTO_COLUMNS = [
  ['taken_at',      'TEXT'],
  ['camera_make',   'TEXT'],
  ['camera_model',  'TEXT'],
  ['lens',          'TEXT'],
  ['focal_length',  'TEXT'],
  ['aperture',      'TEXT'],
  ['shutter_speed', 'TEXT'],
  ['iso',           'TEXT'],
  ['blur_data_url', 'TEXT'],
  ['original_quality', 'INTEGER DEFAULT 0'],
]

const ALBUM_COLUMNS = [
  ['cover_photo_id', 'INTEGER REFERENCES photos(id) ON DELETE SET NULL'],
  ['updated_at',      "TEXT DEFAULT (datetime('now'))"],
  ['token_version',   'INTEGER DEFAULT 0'],
]

function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

function initDb() {
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      password TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      thumb TEXT NOT NULL,
      original_name TEXT,
      width INTEGER,
      height INTEGER,
      file_size INTEGER,
      sort_order INTEGER DEFAULT 0,
      is_portfolio INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_photos_album ON photos(album_id);
    CREATE INDEX IF NOT EXISTS idx_photos_portfolio ON photos(is_portfolio);
  `)

  for (const [col, def] of PHOTO_COLUMNS) addColumnIfMissing('photos', col, def)
  for (const [col, def] of ALBUM_COLUMNS) addColumnIfMissing('albums', col, def)
}

function getDb() {
  if (!db) throw new Error('Database not initialized')
  return db
}

module.exports = { initDb, getDb }
