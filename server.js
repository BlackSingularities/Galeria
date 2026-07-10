const express = require('express')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const multer = require('multer')
const sharp = require('sharp')
const jwt = require('jsonwebtoken')
const exifr = require('exifr')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const { initDb, getDb } = require('./db')

const app = express()
const PORT = process.env.PORT || 3002
const NODE_ENV = process.env.NODE_ENV || 'development'
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123'
const JWT_SECRET = process.env.JWT_SECRET || 'galeria-secret-change-me-in-production'

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'persist/uploads')
const THUMBS_DIR  = process.env.THUMBS_DIR  || path.join(__dirname, 'persist/thumbs')

fs.mkdirSync(UPLOADS_DIR, { recursive: true })
fs.mkdirSync(THUMBS_DIR,  { recursive: true })

if (NODE_ENV === 'production' && (ADMIN_PASS === 'admin123' || JWT_SECRET === 'galeria-secret-change-me-in-production')) {
  console.warn('\n' + '⚠ '.repeat(20))
  console.warn('UWAGA: ADMIN_PASSWORD i/lub JWT_SECRET nie zostały ustawione — używane są wartości domyślne.')
  console.warn('Ustaw zmienne środowiskowe ADMIN_PASSWORD i JWT_SECRET przed wdrożeniem produkcyjnym!')
  console.warn('⚠ '.repeat(20) + '\n')
}

initDb()

// ── Global middleware ──────────────────────────────────────────────────────────

app.set('trust proxy', 1)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(compression())
app.use(express.json({ limit: '2mb' }))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za kilkanaście minut.' },
})

const PHOTO_DATE_ORDER_DESC = "datetime(COALESCE(NULLIF(p.taken_at, ''), p.created_at)) DESC, p.created_at DESC, p.id DESC"

// ── Media access gate ────────────────────────────────────────────────────────
// Listing endpoints already require a password/token, but the raw file URLs
// used to be served unconditionally by express.static — anyone who learned a
// filename could fetch it forever. This middleware re-checks access on every
// single file request. Portfolio originals and thumbnails stay public for
// display; password-protected album originals require album/admin access.
function protectMedia(req, res, next) {
  const db = getDb()
  const filename = path.basename(req.path)
  const isThumb = filename.startsWith('t_')
  const column = isThumb ? 'thumb' : 'filename'
  const photo = db.prepare(`SELECT p.is_portfolio, a.id as album_id, a.password as album_password, a.token_version as token_version
    FROM photos p LEFT JOIN albums a ON a.id = p.album_id WHERE p.${column} = ?`).get(filename)

  if (!photo) return res.status(404).end()
  if (isThumb) return next()
  if (photo.is_portfolio) return next()

  const token = req.query.t || req.headers.authorization?.replace('Bearer ', '')
  try {
    const p = jwt.verify(token, JWT_SECRET)
    if (p.admin) return next()
    if (photo.album_id && p.albumId === photo.album_id && (p.tokenVersion || 0) === (photo.token_version || 0)) return next()
  } catch {}

  if (photo.album_id && !photo.album_password) return next()
  if (!photo.album_id && !photo.is_portfolio) return next()

  return res.status(403).json({ error: 'Brak dostępu' })
}

// Static files (served directly — nginx proxy strips /galeria prefix)
app.use('/uploads', protectMedia, express.static(UPLOADS_DIR, { maxAge: '1y', immutable: true }))
app.use('/thumbs',  protectMedia, express.static(THUMBS_DIR,  { maxAge: '1y', immutable: true }))

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

// ── Photo processing ─────────────────────────────────────────────────────────

const MAIN_IMAGE_MAX_SIZE = 3000
const MAIN_IMAGE_QUALITY = 90
const THUMB_MAX_SIZE = 800
const THUMB_QUALITY = 82
const LQIP_SIZE = 24
const LQIP_QUALITY = 40
const MAX_UPLOAD_FILES = 1000

function fmtAperture(f) {
  if (!f) return null
  return `f/${Number(f).toFixed(Number(f) % 1 === 0 ? 0 : 1)}`
}
function fmtShutter(t) {
  if (!t) return null
  if (t >= 1) return `${t}s`
  const denom = Math.round(1 / t)
  return `1/${denom}s`
}
function fmtFocal(f) {
  if (!f) return null
  return `${Math.round(f)}mm`
}

// GPS is intentionally never parsed/stored — client photos can contain shoot
// locations that shouldn't leak through gallery metadata.
async function extractExif(filePath) {
  try {
    const data = await exifr.parse(filePath, {
      gps: false,
      pick: ['Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal', 'CreateDate'],
    })
    if (!data) return {}
    const make = data.Make?.trim()
    const model = data.Model?.trim()
    const takenAt = data.DateTimeOriginal || data.CreateDate
    return {
      camera_make: make || null,
      camera_model: model && make && model.startsWith(make) ? model.slice(make.length).trim() || model : model || null,
      lens: data.LensModel?.trim() || null,
      aperture: fmtAperture(data.FNumber),
      shutter_speed: fmtShutter(data.ExposureTime),
      iso: data.ISO ? String(data.ISO) : null,
      focal_length: fmtFocal(data.FocalLength),
      taken_at: takenAt instanceof Date && !isNaN(takenAt) ? takenAt.toISOString() : null,
    }
  } catch {
    return {}
  }
}

// EXIF orientation 5-8 means the raw pixel grid is rotated 90°/270° relative
// to how it's displayed — swap width/height so stored dimensions match what
// browsers actually render (they auto-rotate JPEGs per the orientation tag).
function displayDims(meta) {
  const rotated = meta.orientation >= 5 && meta.orientation <= 8
  return rotated ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height }
}

async function processUploadedPhoto(file, keepOriginal) {
  const exif = await extractExif(file.path)

  const baseName = path.basename(file.filename, path.extname(file.filename))
  const srcExt = path.extname(file.filename).toLowerCase()
  const filename = keepOriginal ? `${baseName}${srcExt}` : `${baseName}.jpg`
  const thumb = `t_${filename.replace(/\.[^.]+$/, '')}.jpg`
  const outputPath = path.join(UPLOADS_DIR, filename)

  let width, height, fileSize

  if (keepOriginal) {
    fs.renameSync(file.path, outputPath)
    const meta = await sharp(outputPath).metadata()
    ;({ width, height } = displayDims(meta))
    fileSize = fs.statSync(outputPath).size
  } else {
    const tempPath = path.join(UPLOADS_DIR, `${baseName}.processed.jpg`)
    const info = await sharp(file.path)
      .rotate()
      .resize(MAIN_IMAGE_MAX_SIZE, MAIN_IMAGE_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: MAIN_IMAGE_QUALITY, progressive: true })
      .toFile(tempPath)
    try { fs.unlinkSync(file.path) } catch {}
    fs.renameSync(tempPath, outputPath)
    width = info.width; height = info.height; fileSize = info.size
  }

  await sharp(outputPath)
    .rotate()
    .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY, progressive: true })
    .toFile(path.join(THUMBS_DIR, thumb))

  const lqipBuffer = await sharp(outputPath)
    .rotate()
    .resize(LQIP_SIZE, LQIP_SIZE, { fit: 'inside' })
    .jpeg({ quality: LQIP_QUALITY })
    .toBuffer()
  const blurDataUrl = `data:image/jpeg;base64,${lqipBuffer.toString('base64')}`

  return { filename, thumb, width, height, fileSize, blurDataUrl, exif, originalQuality: !!keepOriginal }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

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

function issueAlbumToken(album) {
  return jwt.sign({ albumId: album.id, tokenVersion: album.token_version || 0 }, JWT_SECRET, { expiresIn: '30d' })
}

function issueAlbumShareToken(album, expiresIn) {
  return jwt.sign({ albumId: album.id, tokenVersion: album.token_version || 0, shared: true }, JWT_SECRET, { expiresIn })
}

function requireAlbumAccess(req, res, next) {
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE slug = ?').get(req.params.slug)
  if (!album) return res.status(404).json({ error: 'Album not found' })
  req.album = album

  if (!album.password) return next() // public album

  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.t
  try {
    const p = jwt.verify(token, JWT_SECRET)
    if (p.admin) return next()
    if (p.albumId === album.id && (p.tokenVersion || 0) === (album.token_version || 0)) return next()
    throw new Error()
  } catch {
    return res.status(401).json({ error: 'Password required', albumId: album.id, albumName: album.name })
  }
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// ── Public API ────────────────────────────────────────────────────────────────

app.get('/api/portfolio', (req, res) => {
  const db = getDb()
  const photos = db.prepare(`
    SELECT p.id, p.filename, p.thumb, p.display_name, p.width, p.height, p.file_size, p.sort_order, p.is_portfolio,
      p.created_at, p.taken_at, p.camera_make, p.camera_model, p.lens, p.focal_length,
      p.aperture, p.shutter_speed, p.iso, p.blur_data_url
    FROM photos p LEFT JOIN albums a ON p.album_id = a.id
    WHERE p.is_portfolio = 1
    ORDER BY ${PHOTO_DATE_ORDER_DESC}
  `).all()
  res.json(photos)
})

app.post('/api/albums/:slug/verify', authLimiter, (req, res) => {
  const db = getDb()
  const album = db.prepare('SELECT * FROM albums WHERE slug = ?').get(req.params.slug)
  if (!album) return res.status(404).json({ error: 'Album not found' })
  if (!album.password) return res.json({ ok: true, token: null })
  if (album.password !== req.body.password) return res.status(401).json({ error: 'Złe hasło' })
  res.json({ ok: true, token: issueAlbumToken(album) })
})

app.post('/api/albums/:slug/share', requireAlbumAccess, (req, res) => {
  const ttlMap = {
    '1h': '1h',
    '24h': '24h',
    '7d': '7d',
    '30d': '30d',
  }
  const expiresIn = ttlMap[req.body?.expiresIn] || ttlMap['7d']
  if (!req.album.password) return res.json({ ok: true, token: null, expiresIn: null })
  res.json({ ok: true, token: issueAlbumShareToken(req.album, expiresIn), expiresIn })
})

app.get('/api/albums/:slug', requireAlbumAccess, (req, res) => {
  const db = getDb()
  const photos = db.prepare(`
    SELECT * FROM photos p
    WHERE album_id = ?
    ORDER BY ${PHOTO_DATE_ORDER_DESC}
  `).all(req.album.id)
  res.json({ album: { ...req.album, has_password: !!req.album.password, password: undefined, token_version: undefined }, photos })
})

// ── Admin API ─────────────────────────────────────────────────────────────────

app.post('/api/admin/login', authLimiter, (req, res) => {
  if (req.body.password !== ADMIN_PASS) return res.status(401).json({ error: 'Złe hasło' })
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token })
})

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const db = getDb()
  const photoCount = db.prepare('SELECT COUNT(*) n FROM photos').get().n
  const portfolioCount = db.prepare('SELECT COUNT(*) n FROM photos WHERE is_portfolio = 1').get().n
  const albumCount = db.prepare('SELECT COUNT(*) n FROM albums').get().n
  const privateAlbumCount = db.prepare("SELECT COUNT(*) n FROM albums WHERE password IS NOT NULL AND password != ''").get().n
  const storageBytes = db.prepare('SELECT COALESCE(SUM(file_size),0) n FROM photos').get().n
  const recentPhotos = db.prepare(`
    SELECT p.id, p.thumb, p.original_name, p.created_at, a.name as album_name
    FROM photos p LEFT JOIN albums a ON p.album_id = a.id
    ORDER BY ${PHOTO_DATE_ORDER_DESC} LIMIT 8
  `).all()
  const recentAlbums = db.prepare(`
    SELECT a.*, COUNT(p.id) as photo_count
    FROM albums a LEFT JOIN photos p ON p.album_id = a.id
    GROUP BY a.id ORDER BY a.created_at DESC LIMIT 5
  `).all()
  res.json({ photoCount, portfolioCount, albumCount, privateAlbumCount, storageBytes, recentPhotos, recentAlbums })
})

app.get('/api/admin/albums', requireAdmin, (req, res) => {
  const db = getDb()
  const albums = db.prepare(`
    SELECT a.*, COUNT(p.id) as photo_count, cp.thumb as cover_thumb
    FROM albums a
    LEFT JOIN photos p ON p.album_id = a.id
    LEFT JOIN photos cp ON cp.id = a.cover_photo_id
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
  const existing = db.prepare('SELECT password, token_version FROM albums WHERE id=?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Album not found' })
  const newPassword = password || null
  // Any password change (set, cleared, or changed) revokes every link and
  // token issued under the old password.
  const bumpVersion = newPassword !== existing.password
  db.prepare(`UPDATE albums SET name=?,description=?,password=?,updated_at=datetime('now')
    ${bumpVersion ? ',token_version=token_version+1' : ''} WHERE id=?`)
    .run(name, description || '', newPassword, req.params.id)
  res.json({ ok: true, revoked: bumpVersion })
})

app.put('/api/admin/albums/:id/cover', requireAdmin, (req, res) => {
  const db = getDb()
  const { photoId } = req.body
  if (photoId) {
    const photo = db.prepare('SELECT id FROM photos WHERE id=? AND album_id=?').get(photoId, req.params.id)
    if (!photo) return res.status(400).json({ error: 'Zdjęcie nie należy do tego albumu' })
  }
  db.prepare("UPDATE albums SET cover_photo_id=?,updated_at=datetime('now') WHERE id=?")
    .run(photoId || null, req.params.id)
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
app.post('/api/admin/albums/:id/upload', requireAdmin, upload.array('photos', MAX_UPLOAD_FILES), async (req, res) => {
  const db = getDb()
  const albumId = parseInt(req.params.id)
  const keepOriginal = req.body.quality === 'original'
  const results = []
  const insert = db.prepare(`
    INSERT INTO photos (album_id,filename,thumb,original_name,width,height,file_size,blur_data_url,original_quality,
      taken_at,camera_make,camera_model,lens,focal_length,aperture,shutter_speed,iso)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `)

  for (const file of req.files || []) {
    try {
      const p = await processUploadedPhoto(file, keepOriginal)
      const r = insert.run(albumId, p.filename, p.thumb, file.originalname, p.width, p.height, p.fileSize, p.blurDataUrl, p.originalQuality ? 1 : 0,
        p.exif.taken_at, p.exif.camera_make, p.exif.camera_model, p.exif.lens, p.exif.focal_length, p.exif.aperture, p.exif.shutter_speed, p.exif.iso)
      results.push({ id: r.lastInsertRowid })
    } catch (e) { console.error('upload err:', e.message) }
  }
  db.prepare("UPDATE albums SET updated_at=datetime('now') WHERE id=?").run(albumId)
  res.json({ uploaded: results.length, results })
})

// Upload to portfolio (no album)
app.post('/api/admin/portfolio/upload', requireAdmin, upload.array('photos', MAX_UPLOAD_FILES), async (req, res) => {
  const db = getDb()
  const keepOriginal = req.body.quality === 'original'
  const results = []
  const insert = db.prepare(`
    INSERT INTO photos (album_id,filename,thumb,original_name,width,height,file_size,is_portfolio,blur_data_url,original_quality,
      taken_at,camera_make,camera_model,lens,focal_length,aperture,shutter_speed,iso)
    VALUES (NULL,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?)
  `)

  for (const file of req.files || []) {
    try {
      const p = await processUploadedPhoto(file, keepOriginal)
      const r = insert.run(p.filename, p.thumb, file.originalname, p.width, p.height, p.fileSize, p.blurDataUrl, p.originalQuality ? 1 : 0,
        p.exif.taken_at, p.exif.camera_make, p.exif.camera_model, p.exif.lens, p.exif.focal_length, p.exif.aperture, p.exif.shutter_speed, p.exif.iso)
      results.push({ id: r.lastInsertRowid })
    } catch (e) { console.error('upload err:', e.message) }
  }
  res.json({ uploaded: results.length, results })
})

app.get('/api/admin/photos', requireAdmin, (req, res) => {
  const db = getDb()
  const photos = db.prepare(`
    SELECT p.*, a.name as album_name, a.slug as album_slug,
      CASE WHEN a.cover_photo_id = p.id THEN 1 ELSE 0 END as is_cover
    FROM photos p LEFT JOIN albums a ON p.album_id = a.id
    ORDER BY ${PHOTO_DATE_ORDER_DESC}
  `).all()
  res.json(photos)
})

app.put('/api/admin/photos/reorder', requireAdmin, (req, res) => {
  const db = getDb()
  const { ids } = req.body
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids wymagane' })
  const update = db.prepare('UPDATE photos SET sort_order=? WHERE id=?')
  const tx = db.transaction((list) => {
    list.forEach((id, i) => update.run(i, id))
  })
  tx(ids)
  res.json({ ok: true })
})

app.put('/api/admin/photos/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const { is_portfolio, sort_order, original_name, display_name, album_id, taken_at, camera_make, camera_model, lens, focal_length, aperture, shutter_speed, iso } = req.body
  db.prepare(`UPDATE photos SET is_portfolio=?,sort_order=?,original_name=?,display_name=?,album_id=?,
    taken_at=?,camera_make=?,camera_model=?,lens=?,focal_length=?,aperture=?,shutter_speed=?,iso=? WHERE id=?`)
    .run(is_portfolio ? 1 : 0, sort_order ?? 0, original_name || null, display_name || null, album_id ?? null,
      taken_at || null, camera_make || null, camera_model || null, lens || null, focal_length || null, aperture || null, shutter_speed || null, iso || null, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/admin/photos/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const photo = db.prepare('SELECT * FROM photos WHERE id=?').get(req.params.id)
  if (!photo) return res.status(404).json({ error: 'Not found' })
  try { fs.unlinkSync(path.join(UPLOADS_DIR, photo.filename)) } catch {}
  try { fs.unlinkSync(path.join(THUMBS_DIR,  photo.thumb))    } catch {}
  db.prepare('DELETE FROM photos WHERE id=?').run(photo.id)
  db.prepare('UPDATE albums SET cover_photo_id=NULL WHERE cover_photo_id=?').run(photo.id)
  res.json({ ok: true })
})

// ── SPA ───────────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ── Error handling ────────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Plik jest większy niż limit uploadu serwera.' : err.message
    return res.status(400).json({ error: msg })
  }
  console.error(err)
  res.status(500).json({ error: 'Wewnętrzny błąd serwera' })
})

app.listen(PORT, () => console.log(`Galeria :${PORT} [${NODE_ENV}]`))
