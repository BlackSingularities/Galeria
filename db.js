const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'persist/db/galeria.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

let db

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
  `)
}

function getDb() {
  if (!db) throw new Error('Database not initialized')
  return db
}

module.exports = { initDb, getDb }
