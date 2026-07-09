const express = require('express')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const multer = require('multer')
const sharp = require('sharp')
const jwt = require('jsonwebtoken')
const { initDb, getDb } = require('./db')

const app = express()
const PORT = process.env.PORT || 3002
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123'
const JWT_SECRET = process.env.JWT_SECRET || 'galeria-secret-change-me-in-production'

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'persist/uploads')
const THUMBS_DIR  = process.env.THUMBS_DIR  || path.join(__dirname, 'persist/thumbs')

fs.mkdirSync(UPLOADS_DIR, { recursive: true })
fs.mkdirSync(THUMBS_DIR,  { recursive: true })

initDb()
app.use(express.json())

// Static files (served directly — nginx proxy strips /galeria prefix)
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1y' }))
app.use('/thumbs',  express.static(THUMBS_DIR,  { maxAge: '1y' }))

// Multer
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /\.(jpg|jpeg|png|webp|gif|tiff|heic|avif)$/i.test(file.originalname))
  },
})

// ── Auth helpers ──────────────────────────────────────────────────────────────

const MAIN_IMAGE_MAX_SIZE = 3000
const MAIN_IMAGE_QUALITY = 90
const THUMB_MAX_SIZE = 800
const THUMB_QUALITY = 82

async function processUploadedPhoto(file) {
  const baseName = path.basename(file.filename, path.extname(file.filename))
  const filename = `${baseName}.jpg`
  const thumb = `t_${filename}`
  const outputPath = path.join(UPLOADS_DIR, filename)
  const tempPath = path.join(UPLOADS_DIR, `${baseName}.processed.jpg`)

  const info = await sharp(file.path)
    .rotate()
    .resize(MAIN_IMAGE_MAX_SIZE, MAIN_IMAGE_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: MAIN_IMAGE_QUALITY, progressive: true })
    .toFile(tempPath)

  try { fs.unlinkSync(file.path) } catch {}
  fs.renameSync(tempPath, outputPath)

  await sharp(outputPath)
    .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY, progressive: true })
    .toFile(path.join(THUMBS_DIR, thumb))

  return { filename, thumb, width: info.width, height: info.height, fileSize: info.size }
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  try {
    const p = jwt.verify(token, JWT_SECRET)
    if (!p.admin) throw new Error()
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

function requireAlbumAccess(req, res, next) {
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE slug = ?').get(req.params.slug)
  if (!album) return res.status(404).json({ error: 'Album not found' })
  req.album = album

  if (!album.password) return next() // public album

  const token = req.headers.authorization?.replace('Bearer ', '')
  try {
    const p = jwt.verify(token, JWT_SECRET)
    if (p.admin || p.albumId === album.id) return next()
    throw new Error()
  } catch {
    return res.status(401).json({ error: 'Password required', albumId: album.id })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

app.get('/api/portfolio', (req, res) => {
  const db = getDb()
  const photos = db.prepare(`
    SELECT p.*, a.name as album_name, a.slug as album_slug
    FROM photos p LEFT JOIN albums a ON p.album_id = a.id
    WHERE p.is_portfolio = 1
    ORDER BY p.sort_order ASC, p.created_at DESC
  `).all()
  res.json(photos)
})

app.post('/api/albums/:slug/verify', (req, res) => {
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE slug = ?').get(req.params.slug)
  if (!album) return res.status(404).json({ error: 'Album not found' })
  if (!album.password) return res.json({ ok: true, token: null })
  if (album.password !== req.body.password) return res.status(401).json({ error: 'Złe hasło' })
  const token = jwt.sign({ albumId: album.id }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ ok: true, token })
})

app.get('/api/albums/:slug', requireAlbumAccess, (req, res) => {
  const db = getDb()
  const photos = db.prepare(
    'SELECT * FROM photos WHERE album_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).all(req.album.id)
  res.json({ album: { ...req.album, password: undefined }, photos })
})

// ── Admin API ─────────────────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASS) return res.status(401).json({ error: 'Złe hasło' })
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token })
})

app.get('/api/admin/albums', requireAdmin, (req, res) => {
  const db = getDb()
  const albums = db.prepare(`
    SELECT a.*, COUNT(p.id) as photo_count
    FROM albums a LEFT JOIN photos p ON p.album_id = a.id
    GROUP BY a.id ORDER BY a.created_at DESC
  `).all()
  res.json(albums)
})

app.post('/api/admin/albums', requireAdmin, (req, res) => {
  const db = getDb()
  const { name, description, password } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nazwa wymagana' })
  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    + '-' + Date.now().toString(36)
  const r = db.prepare(
    'INSERT INTO albums (slug,name,description,password) VALUES (?,?,?,?)'
  ).run(slug, name.trim(), description || '', password || null)
  res.json({ id: r.lastInsertRowid, slug })
})

app.put('/api/admin/albums/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const { name, description, password } = req.body
  db.prepare('UPDATE albums SET name=?,description=?,password=? WHERE id=?')
    .run(name, description || '', password || null, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/admin/albums/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const photos = db.prepare('SELECT filename,thumb FROM photos WHERE album_id=?').all(req.params.id)
  for (const p of photos) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, p.filename)) } catch {}
    try { fs.unlinkSync(path.join(THUMBS_DIR,  p.thumb))    } catch {}
  }
  db.prepare('DELETE FROM albums WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// Upload to album
app.post('/api/admin/albums/:id/upload', requireAdmin, upload.array('photos', 50), async (req, res) => {
  const db = getDb()
  const albumId = parseInt(req.params.id)
  const results = []

  for (const file of req.files || []) {
    try {
      const processed = await processUploadedPhoto(file)
      const r = db.prepare(
        'INSERT INTO photos (album_id,filename,thumb,original_name,width,height,file_size) VALUES (?,?,?,?,?,?,?)'
      ).run(albumId, processed.filename, processed.thumb, file.originalname, processed.width, processed.height, processed.fileSize)
      results.push({ id: r.lastInsertRowid })
    } catch (e) { console.error('upload err:', e.message) }
  }
  res.json({ uploaded: results.length, results })
})

// Upload to portfolio (no album)
app.post('/api/admin/portfolio/upload', requireAdmin, upload.array('photos', 50), async (req, res) => {
  const db = getDb()
  const results = []

  for (const file of req.files || []) {
    try {
      const processed = await processUploadedPhoto(file)
      const r = db.prepare(
        'INSERT INTO photos (album_id,filename,thumb,original_name,width,height,file_size,is_portfolio) VALUES (NULL,?,?,?,?,?,?,1)'
      ).run(processed.filename, processed.thumb, file.originalname, processed.width, processed.height, processed.fileSize)
      results.push({ id: r.lastInsertRowid })
    } catch (e) { console.error('upload err:', e.message) }
  }
  res.json({ uploaded: results.length, results })
})

app.get('/api/admin/photos', requireAdmin, (req, res) => {
  const db = getDb()
  const photos = db.prepare(`
    SELECT p.*, a.name as album_name, a.slug as album_slug
    FROM photos p LEFT JOIN albums a ON p.album_id = a.id
    ORDER BY p.created_at DESC
  `).all()
  res.json(photos)
})

app.put('/api/admin/photos/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const { is_portfolio, sort_order, original_name, album_id } = req.body
  db.prepare('UPDATE photos SET is_portfolio=?,sort_order=?,original_name=?,album_id=? WHERE id=?')
    .run(is_portfolio ? 1 : 0, sort_order ?? 0, original_name, album_id ?? null, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/admin/photos/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const photo = db.prepare('SELECT * FROM photos WHERE id=?').get(req.params.id)
  if (!photo) return res.status(404).json({ error: 'Not found' })
  try { fs.unlinkSync(path.join(UPLOADS_DIR, photo.filename)) } catch {}
  try { fs.unlinkSync(path.join(THUMBS_DIR,  photo.thumb))    } catch {}
  db.prepare('DELETE FROM photos WHERE id=?').run(photo.id)
  res.json({ ok: true })
})

// ── SPA ───────────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, () => console.log(`Galeria :${PORT}`))
