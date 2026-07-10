import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  adminLogin, adminGetStats, adminGetAlbums, adminCreateAlbum, adminUpdateAlbum, adminDeleteAlbum,
  adminSetAlbumCover, adminGetPhotos, adminUpdatePhoto, adminReorderPhotos, adminDeletePhoto, adminUpload,
  thumbUrl,
} from '../api'
import Grid from '../components/Grid'
import { useToast, useConfirm } from '../components/Feedback'
import {
  IconFolder, IconImage, IconUpload, IconSearch, IconStar, IconLock, IconGlobe,
  IconEdit, IconTrash, IconLink, IconClose,
} from '../components/icons'

// Admin views can show photos from password-protected albums — the admin JWT
// bypasses the per-photo media gate, so thread it through wherever we render
// a thumbnail/full image outside the public-only Portfolio/Album pages.
const adminToken = () => localStorage.getItem('admin_token')

function fmtBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pass, setPass]     = useState('')
  const [show, setShow]     = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { token } = await adminLogin(pass)
      localStorage.setItem('admin_token', token)
      onLogin(token)
    } catch (err) {
      setError(err.message || 'Błąd logowania')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className={`login-box ${error ? 'shake' : ''}`}>
        <div style={{ marginBottom:24 }}>
          <p style={{ color:'var(--gold)', fontSize:11, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:8 }}>
            Panel administracyjny
          </p>
          <h1 className="login-title">Galeria</h1>
          <p className="login-sub">Podaj hasło administratora</p>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <div className="input-with-action">
              <input type={show ? 'text' : 'password'} className="input" placeholder="Hasło" value={pass}
                onChange={e => setPass(e.target.value)} autoFocus />
              <button type="button" className="input-action" onClick={() => setShow(v => !v)} tabIndex={-1}>
                {show ? 'Ukryj' : 'Pokaż'}
              </button>
            </div>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn" style={{ width:'100%', marginTop:8 }} disabled={loading}>
            {loading ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>
        <div style={{ marginTop:24, textAlign:'center' }}>
          <Link to="/" style={{ color:'var(--text-3)', fontSize:13 }}>← Wróć do galerii</Link>
        </div>
      </div>
    </div>
  )
}

// ── Upload dropzone ───────────────────────────────────────────────────────────
function Dropzone({ albumId, onDone }) {
  const maxFiles = 1000
  const [files, setFiles]       = useState([])
  const [quality, setQuality]   = useState('optimized')
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()
  const dragRef  = useRef(0)
  const toast = useToast()

  const add = (fl) => {
    const incoming = Array.from(fl).map(file => ({ file, preview: URL.createObjectURL(file) }))
    setFiles(prev => {
      const next = [...prev, ...incoming].slice(0, maxFiles)
      if (prev.length + incoming.length > maxFiles) {
        setTimeout(() => toast.error(`Możesz dodać maksymalnie ${maxFiles} zdjęć naraz.`), 0)
      }
      return next
    })
  }

  const onDrop = (e) => {
    e.preventDefault(); dragRef.current = 0
    e.currentTarget.classList.remove('drag-over')
    add(e.dataTransfer.files)
  }

  const removeAt = (i) => setFiles(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, j) => j !== i) })
  const clearAll = () => { files.forEach(f => URL.revokeObjectURL(f.preview)); setFiles([]) }

  const upload = async () => {
    if (!files.length) return
    setUploading(true); setProgress(0)
    const total = files.length
    try {
      const { uploaded } = await adminUpload(
        albumId, files.map(f => f.file), setProgress,
        (file, i) => setCurrentFile({ name: file.name, index: i + 1, total }),
        quality,
      )
      toast.success(`Wgrano ${uploaded} ${uploaded === 1 ? 'zdjęcie' : 'zdjęć'}.`)
      clearAll()
      onDone?.()
    } catch (e) {
      toast.error('Błąd uploadu: ' + e.message)
    } finally {
      setUploading(false); setProgress(0); setCurrentFile(null)
    }
  }

  const fmtSize = (b) => b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`

  return (
    <div>
      <div className="quality-toggle" role="radiogroup" aria-label="Jakość zdjęć">
        <button
          type="button"
          className={`quality-option ${quality === 'optimized' ? 'active' : ''}`}
          onClick={() => setQuality('optimized')}
          role="radio"
          aria-checked={quality === 'optimized'}
        >
          <span className="quality-option-title">Zoptymalizowane</span>
          <span className="quality-option-desc">Skalowane do 3000px, JPEG · szybkie ładowanie, mniejszy rozmiar</span>
        </button>
        <button
          type="button"
          className={`quality-option ${quality === 'original' ? 'active' : ''}`}
          onClick={() => setQuality('original')}
          role="radio"
          aria-checked={quality === 'original'}
        >
          <span className="quality-option-title">Oryginalna jakość (1:1)</span>
          <span className="quality-option-desc">Bez kompresji i skalowania · większe pliki, zachowuje pełne EXIF/GPS</span>
        </button>
      </div>

      <div
        className="dropzone"
        onClick={() => inputRef.current.click()}
        onDragEnter={(e) => { e.preventDefault(); if (++dragRef.current === 1) e.currentTarget.classList.add('drag-over') }}
        onDragLeave={(e) => { e.preventDefault(); if (--dragRef.current === 0) e.currentTarget.classList.remove('drag-over') }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <IconUpload width={32} height={32} style={{ opacity:.5, marginBottom:12 }} />
        <p className="dropzone-text">Kliknij lub przeciągnij zdjęcia tutaj</p>
        <p className="dropzone-hint">JPG, PNG, WEBP, TIFF · max 150 MB / plik · do 1000 plików naraz</p>
        <input ref={inputRef} type="file" multiple accept="image/*" style={{ display:'none' }}
          onChange={e => { add(e.target.files); e.target.value = '' }} />
      </div>

      {files.length > 0 && !uploading && (
        <div className="upload-preview-grid">
          {files.map((f, i) => (
            <div key={i} className="upload-preview-item">
              <img src={f.preview} alt="" />
              <button className="upload-preview-remove" onClick={() => removeAt(i)} title="Usuń z kolejki"><IconClose width={11} height={11} /></button>
              <span className="upload-preview-size">{fmtSize(f.file.size)}</span>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div style={{ marginTop:16 }}>
          {currentFile && (
            <p style={{ fontSize:12, color:'var(--text-2)', marginBottom:8 }}>
              Wysyłanie {currentFile.index}/{currentFile.total}: <span style={{ color:'var(--text)' }}>{currentFile.name}</span>
            </p>
          )}
          <div className="upload-progress">
            <div className="upload-progress-bar" style={{ width: `${progress*100}%` }} />
          </div>
        </div>
      )}

      {files.length > 0 && !uploading && (
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button className="btn" onClick={upload}>
            Wgraj {files.length} {files.length === 1 ? 'zdjęcie' : 'zdjęcia/ć'}
          </button>
          <button className="btn btn-ghost" onClick={clearAll}>Wyczyść</button>
        </div>
      )}
    </div>
  )
}

// ── Album modal ───────────────────────────────────────────────────────────────
function AlbumModal({ album, onClose, onSave }) {
  const [name, setName]       = useState(album?.name || '')
  const [desc, setDesc]       = useState(album?.description || '')
  const [pass, setPass]       = useState(album?.password || '')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const genPassword = () => {
    const words = ['blask','swiatlo','kadr','migawka','sesja','wesele','plener','portret']
    const w = words[Math.floor(Math.random() * words.length)]
    setPass(`${w}-${Math.floor(1000 + Math.random() * 9000)}`)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      if (album?.id) await adminUpdateAlbum(album.id, { name, description:desc, password:pass || null })
      else await adminCreateAlbum({ name, description:desc, password:pass || null })
      toast.success(album?.id ? 'Album zaktualizowany' : 'Album utworzony')
      onSave()
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 className="modal-title">{album ? 'Edytuj album' : 'Nowy album'}</h3>
        <form onSubmit={save}>
          <div className="field">
            <label>Nazwa albumu</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="field">
            <label>Opis (opcjonalnie)</label>
            <textarea className="input" rows={2} value={desc} onChange={e => setDesc(e.target.value)} style={{ resize:'vertical' }} />
          </div>
          <div className="field">
            <label>Hasło (puste = publiczny album)</label>
            <div className="input-with-action">
              <input className="input" type={showPass ? 'text' : 'password'} placeholder="Brak hasła = album publiczny"
                value={pass} onChange={e => setPass(e.target.value)} />
              <button type="button" className="input-action" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                {showPass ? 'Ukryj' : 'Pokaż'}
              </button>
            </div>
            <button type="button" className="btn-ghost btn-sm" style={{ marginTop:8 }} onClick={genPassword}>
              Wygeneruj hasło
            </button>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Anuluj</button>
            <button type="submit" className="btn" disabled={loading}>{loading ? 'Zapisuję…' : 'Zapisz'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PhotoModal({ photo, onClose, onSave }) {
  const [form, setForm] = useState({
    display_name: photo.display_name || '',
    original_name: photo.original_name || '',
    taken_at: photo.taken_at || '',
    camera_make: photo.camera_make || '',
    camera_model: photo.camera_model || '',
    lens: photo.lens || '',
    focal_length: photo.focal_length || '',
    aperture: photo.aperture || '',
    shutter_speed: photo.shutter_speed || '',
    iso: photo.iso || '',
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminUpdatePhoto(photo.id, { ...photo, ...form })
      toast.success('Dane zdjęcia zapisane')
      onSave()
    } catch {
      toast.error('Nie udało się zapisać danych zdjęcia')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal photo-modal">
        <h3 className="modal-title">Edytuj zdjęcie</h3>
        <form onSubmit={save}>
          <div className="field">
            <label>Nazwa widoczna</label>
            <input className="input" value={form.display_name} onChange={set('display_name')} placeholder="Puste = bez podpisu na kafelku" autoFocus />
          </div>
          <div className="field">
            <label>Nazwa pliku / opis techniczny</label>
            <input className="input" value={form.original_name} onChange={set('original_name')} />
          </div>
          <div className="form-grid-2">
            <div className="field"><label>Data wykonania</label><input className="input" value={form.taken_at} onChange={set('taken_at')} placeholder="YYYY-MM-DD" /></div>
            <div className="field"><label>Producent aparatu</label><input className="input" value={form.camera_make} onChange={set('camera_make')} /></div>
            <div className="field"><label>Model aparatu</label><input className="input" value={form.camera_model} onChange={set('camera_model')} /></div>
            <div className="field"><label>Obiektyw</label><input className="input" value={form.lens} onChange={set('lens')} /></div>
            <div className="field"><label>Ogniskowa</label><input className="input" value={form.focal_length} onChange={set('focal_length')} /></div>
            <div className="field"><label>Przysłona</label><input className="input" value={form.aperture} onChange={set('aperture')} /></div>
            <div className="field"><label>Czas</label><input className="input" value={form.shutter_speed} onChange={set('shutter_speed')} /></div>
            <div className="field"><label>ISO</label><input className="input" value={form.iso} onChange={set('iso')} /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Anuluj</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">{icon}</div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  )
}

function TabDashboard({ onNavigate }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { adminGetStats().then(setStats).catch(console.error) }, [])

  if (!stats) return <div className="spinner" />

  return (
    <div>
      <div className="stat-grid">
        <StatCard icon={<IconImage />} label="Zdjęcia łącznie" value={stats.photoCount} />
        <StatCard icon={<IconStar />} label="W portfolio" value={stats.portfolioCount} />
        <StatCard icon={<IconFolder />} label="Albumy klientów" value={stats.albumCount} sub={`${stats.privateAlbumCount} prywatnych`} />
        <StatCard icon={<IconUpload />} label="Zajęte miejsce" value={fmtBytes(stats.storageBytes)} />
      </div>

      <div className="dash-grid">
        <div>
          <div className="dash-section-header">
            <h3 className="dash-section-title">Ostatnio dodane</h3>
            <button className="nav-link" onClick={() => onNavigate('photos')}>Zobacz wszystkie →</button>
          </div>
          {stats.recentPhotos.length === 0 ? (
            <p style={{ color:'var(--text-3)', fontSize:13 }}>Brak zdjęć. Zacznij od uploadu.</p>
          ) : (
            <div className="recent-photo-strip">
              {stats.recentPhotos.map(p => (
                <div key={p.id} className="recent-photo" title={p.original_name}>
                  <img src={thumbUrl(p.thumb, adminToken())} alt="" />
                  <span className="recent-photo-label">{p.album_name || 'Portfolio'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="dash-section-header">
            <h3 className="dash-section-title">Ostatnie albumy</h3>
            <button className="nav-link" onClick={() => onNavigate('albums')}>Zobacz wszystkie →</button>
          </div>
          {stats.recentAlbums.length === 0 ? (
            <p style={{ color:'var(--text-3)', fontSize:13 }}>Brak albumów.</p>
          ) : (
            <div className="dash-album-list">
              {stats.recentAlbums.map(a => (
                <div key={a.id} className="dash-album-row">
                  <span className="dash-album-badge">{a.password ? <IconLock /> : <IconGlobe />}</span>
                  <span style={{ flex:1 }}>{a.name}</span>
                  <span style={{ color:'var(--text-3)', fontSize:12 }}>{a.photo_count} zdjęć</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dash-quick-actions">
        <button className="btn" onClick={() => onNavigate('upload')}><IconUpload /> Wgraj zdjęcia do portfolio</button>
        <button className="btn btn-ghost" onClick={() => onNavigate('albums')}><IconFolder /> Zarządzaj albumami</button>
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function TabPortfolio() {
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [editPhoto, setEditPhoto] = useState(null)
  const toast = useToast()
  const confirm = useConfirm()

  const load = () => {
    adminGetPhotos()
      .then(d => setPhotos(d.filter(p => p.is_portfolio || !p.album_id)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const deletePhoto = async (id) => {
    if (!await confirm('Usunąć zdjęcie?', { detail: 'Plik zostanie trwale usunięty z serwera.', danger: true, confirmLabel: 'Usuń' })) return
    await adminDeletePhoto(id)
    setPhotos(p => p.filter(x => x.id !== id))
    toast.success('Zdjęcie usunięte')
  }

  const bulkDelete = async () => {
    if (!await confirm(`Usunąć ${selected.length} zdjęć?`, { danger: true, confirmLabel: 'Usuń wszystkie' })) return
    for (const id of selected) await adminDeletePhoto(id)
    toast.success(`Usunięto ${selected.length} zdjęć`)
    setSelected([])
    load()
  }

  const handleReorder = async (ids) => {
    setPhotos(prev => ids.map(id => prev.find(p => p.id === id)))
    try { await adminReorderPhotos(ids) } catch { toast.error('Nie udało się zapisać kolejności'); load() }
  }

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:24, alignItems:'center', minHeight:32 }}>
        {selected.length > 0 && (
          <>
            <span style={{ color:'var(--text-2)', fontSize:13 }}>Zaznaczone: {selected.length}</span>
            <button className="btn btn-danger btn-sm" onClick={bulkDelete}>Usuń zaznaczone</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Odznacz</button>
          </>
        )}
      </div>

      <div style={{ marginBottom:32 }}>
        <p style={{ color:'var(--text-2)', fontSize:13, marginBottom:16 }}>Wgraj nowe zdjęcia do portfolio:</p>
        <Dropzone albumId={null} onDone={load} />
      </div>
      <div className="divider" />

      {!loading && photos.length > 1 && (
        <p style={{ color:'var(--text-3)', fontSize:12, marginBottom:16 }}>Przeciągnij zdjęcia, aby zmienić kolejność wyświetlania.</p>
      )}

      {loading ? <div className="spinner" /> : (
        <Grid
          photos={photos}
          adminMode
          selectable
          reorderable
          onReorder={handleReorder}
          selected={selected}
          onSelect={toggleSelect}
          onDelete={deletePhoto}
          onEditPhoto={setEditPhoto}
          mediaToken={adminToken()}
        />
      )}
      {editPhoto && (
        <PhotoModal
          photo={editPhoto}
          onClose={() => setEditPhoto(null)}
          onSave={() => { setEditPhoto(null); load() }}
        />
      )}
    </div>
  )
}

function TabAlbums({ onManage }) {
  const [albums, setAlbums]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const toast = useToast()
  const confirm = useConfirm()

  const load = () => {
    adminGetAlbums()
      .then(setAlbums)
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const del = async (album) => {
    if (!await confirm(`Usunąć album „${album.name}"?`, { detail: `Wszystkie (${album.photo_count}) zdjęcia w albumie zostaną trwale usunięte.`, danger: true, confirmLabel: 'Usuń album' })) return
    await adminDeleteAlbum(album.id)
    toast.success('Album usunięty')
    load()
  }

  const copyLink = (slug) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,'')}/album/${slug}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link skopiowany')).catch(() => toast.error('Nie udało się skopiować'))
  }

  const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, '')

  return (
    <div>
      <button className="btn" style={{ marginBottom:24 }} onClick={() => setModal('new')}>+ Nowy album</button>

      {loading ? <div className="spinner" /> : (
        albums.length === 0 ? (
          <div className="empty-state"><p>Brak albumów. Utwórz pierwszy album klikając przycisk powyżej.</p></div>
        ) : (
          <div className="album-list">
            {albums.map(a => (
              <div key={a.id} className="album-card">
                <div className="album-card-cover" onClick={() => onManage(a)} role="button" tabIndex={0}>
                  {a.cover_thumb
                    ? <img src={thumbUrl(a.cover_thumb, adminToken())} alt="" />
                    : <div className="album-card-cover-empty"><IconFolder width={22} height={22} /></div>}
                </div>
                <div className="album-card-body">
                  <div className="album-card-name">{a.name}</div>
                  <div className="album-card-meta">{a.photo_count} zdjęć · {new Date(a.created_at).toLocaleDateString('pl')}</div>
                  <div className="album-card-badge">
                    {a.password ? <><IconLock /> Prywatny</> : <><IconGlobe /> Publiczny</>}
                  </div>
                  <div className="album-card-actions">
                    <button className="btn btn-sm" onClick={() => onManage(a)}>Zarządzaj</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => copyLink(a.slug)} title="Kopiuj link"><IconLink /></button>
                    <a className="btn btn-ghost btn-sm" href={`${BASE_URL}/album/${a.slug}`} target="_blank" rel="noreferrer" title="Podgląd"><IconGlobe /></a>
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(a)} title="Edytuj"><IconEdit /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(a)} title="Usuń"><IconTrash /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {modal && (
        <AlbumModal
          album={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

function TabAlbumManage({ album, onBack, onAlbumUpdated }) {
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [editPhoto, setEditPhoto] = useState(null)
  const toast = useToast()
  const confirm = useConfirm()

  const load = () => {
    setLoading(true)
    adminGetPhotos()
      .then(d => setPhotos(d.filter(p => p.album_id === album.id)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(load, [album.id])

  const deletePhoto = async (id) => {
    if (!await confirm('Usunąć zdjęcie?', { detail: 'Plik zostanie trwale usunięty z serwera.', danger: true, confirmLabel: 'Usuń' })) return
    await adminDeletePhoto(id)
    setPhotos(p => p.filter(x => x.id !== id))
    toast.success('Zdjęcie usunięte')
  }

  const handleReorder = async (ids) => {
    setPhotos(prev => ids.map(id => prev.find(p => p.id === id)))
    try { await adminReorderPhotos(ids) } catch { toast.error('Nie udało się zapisać kolejności'); load() }
  }

  const setCover = async (photo) => {
    try {
      await adminSetAlbumCover(album.id, photo.id)
      setPhotos(prev => prev.map(p => ({ ...p, is_cover: p.id === photo.id ? 1 : 0 })))
      toast.success('Okładka albumu ustawiona')
      onAlbumUpdated?.({ ...album, cover_photo_id: photo.id, cover_thumb: photo.thumb })
    } catch { toast.error('Nie udało się ustawić okładki') }
  }

  const copyLink = () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,'')}/album/${album.slug}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link skopiowany')).catch(() => toast.error('Nie udało się skopiować'))
  }

  return (
    <div>
      <button className="nav-link" style={{ padding:0, marginBottom:16, display:'inline-block' }} onClick={onBack}>← Wszystkie albumy</button>

      <div className="album-manage-header">
        <div>
          <h3 style={{ fontFamily:'var(--font-serif)', fontSize:'1.6rem', fontWeight:300, marginBottom:4 }}>{album.name}</h3>
          {album.description && <p style={{ color:'var(--text-2)', fontSize:13, maxWidth:520 }}>{album.description}</p>}
          <div className="album-card-badge" style={{ marginTop:10 }}>
            {album.password ? <><IconLock /> Prywatny · hasło: {album.password}</> : <><IconGlobe /> Publiczny</>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={copyLink}><IconLink /> Kopiuj link</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditModal(true)}><IconEdit /> Edytuj</button>
        </div>
      </div>

      <div className="divider" />

      <p style={{ color:'var(--text-2)', fontSize:13, marginBottom:16 }}>Wgraj nowe zdjęcia do tego albumu:</p>
      <Dropzone albumId={album.id} onDone={load} />

      <div className="divider" />

      {!loading && photos.length > 1 && (
        <p style={{ color:'var(--text-3)', fontSize:12, marginBottom:16 }}>Przeciągnij, aby zmienić kolejność. Kliknij gwiazdkę, aby ustawić okładkę albumu.</p>
      )}

      {loading ? <div className="spinner" /> : (
        <Grid
          photos={photos}
          adminMode
          reorderable
          onReorder={handleReorder}
          selected={[]}
          onSelect={() => {}}
          onDelete={deletePhoto}
          onSetCover={setCover}
          onEditPhoto={setEditPhoto}
          mediaToken={adminToken()}
        />
      )}

      {editModal && (
        <AlbumModal
          album={album}
          onClose={() => setEditModal(false)}
          onSave={async () => {
            setEditModal(false)
            const albums = await adminGetAlbums().catch(() => [])
            const updated = albums.find(a => a.id === album.id)
            onAlbumUpdated?.(updated || album)
          }}
        />
      )}
      {editPhoto && (
        <PhotoModal
          photo={editPhoto}
          onClose={() => setEditPhoto(null)}
          onSave={() => { setEditPhoto(null); load() }}
        />
      )}
    </div>
  )
}

function TabUpload() {
  const [albums, setAlbums]   = useState([])
  const [selAlbum, setSelAlbum] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const toast = useToast()

  useEffect(() => {
    adminGetAlbums().then(setAlbums).catch(console.error)
  }, [])

  return (
    <div>
      <div className="field" style={{ maxWidth:380, marginBottom:24 }}>
        <label>Cel</label>
        <select className="input" value={selAlbum} onChange={e => setSelAlbum(e.target.value)}>
          <option value="">Portfolio publiczne</option>
          {albums.map(a => <option key={a.id} value={a.id}>{a.name} ({a.photo_count} zdjęć)</option>)}
        </select>
      </div>
      <Dropzone
        key={`${selAlbum}-${refreshKey}`}
        albumId={selAlbum || null}
        onDone={() => { setRefreshKey(k => k+1); toast.success('Gotowe — zdjęcia dodane.') }}
      />
    </div>
  )
}

function TabPhotos() {
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const [query, setQuery]     = useState('')
  const [editPhoto, setEditPhoto] = useState(null)
  const toast = useToast()
  const confirm = useConfirm()

  const load = () => {
    adminGetPhotos().then(setPhotos).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const deletePhoto = async (id) => {
    if (!await confirm('Usunąć zdjęcie?', { detail: 'Plik zostanie trwale usunięty z serwera.', danger: true, confirmLabel: 'Usuń' })) return
    await adminDeletePhoto(id)
    setPhotos(p => p.filter(x => x.id !== id))
    toast.success('Zdjęcie usunięte')
  }

  const togglePortfolio = async (photo) => {
    await adminUpdatePhoto(photo.id, { ...photo, is_portfolio: photo.is_portfolio ? 0 : 1 })
    load()
  }

  const filtered = useMemo(() => {
    let list = filter === 'all' ? photos
      : filter === 'portfolio' ? photos.filter(p => p.is_portfolio)
      : photos.filter(p => !p.is_portfolio)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(p => p.display_name?.toLowerCase().includes(q) || p.original_name?.toLowerCase().includes(q) || p.album_name?.toLowerCase().includes(q))
    }
    return list
  }, [photos, filter, query])

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div className="search-input">
          <IconSearch />
          <input className="input" placeholder="Szukaj po nazwie pliku lub albumie…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {['all','portfolio','other'].map(v => (
            <button key={v} className={`btn btn-sm ${filter === v ? '' : 'btn-ghost'}`} onClick={() => setFilter(v)}>
              {v === 'all' ? `Wszystkie (${photos.length})` : v === 'portfolio' ? `Portfolio (${photos.filter(p=>p.is_portfolio).length})` : `Albumy (${photos.filter(p=>!p.is_portfolio).length})`}
            </button>
          ))}
        </div>
      </div>
      <p style={{ color:'var(--text-3)', fontSize:12, marginBottom:16 }}>Kliknij gwiazdkę na zdjęciu, aby dodać/usunąć z portfolio publicznego.</p>

      {loading ? <div className="spinner" /> : filtered.length === 0 ? (
        <div className="empty-state"><p>Brak wyników.</p></div>
      ) : (
        <Grid
          photos={filtered}
          adminMode
          selected={[]}
          onSelect={() => {}}
          onDelete={deletePhoto}
          onTogglePortfolio={togglePortfolio}
          onEditPhoto={setEditPhoto}
          mediaToken={adminToken()}
        />
      )}
      {editPhoto && (
        <PhotoModal
          photo={editPhoto}
          onClose={() => setEditPhoto(null)}
          onSave={() => { setEditPhoto(null); load() }}
        />
      )}
    </div>
  )
}

// ── Admin shell ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [token, setToken]  = useState(() => localStorage.getItem('admin_token'))
  const [tab, setTab]      = useState('dashboard')
  const [manageAlbum, setManageAlbum] = useState(null)
  const toast = useToast()

  const logout = () => {
    localStorage.removeItem('admin_token')
    setToken(null)
    toast.info('Wylogowano')
  }

  const navigate = (t) => { setTab(t); if (t !== 'albumManage') setManageAlbum(null) }
  const manage = (album) => { setManageAlbum(album); setTab('albumManage') }

  if (!token) return <LoginScreen onLogin={setToken} />

  const tabs = [
    { id:'dashboard', label:'Pulpit',              icon:<IconImage /> },
    { id:'portfolio', label:'Portfolio publiczne',  icon:<IconStar /> },
    { id:'albums',    label:'Albumy klientów',      icon:<IconFolder /> },
    { id:'photos',    label:'Wszystkie zdjęcia',    icon:<IconSearch /> },
    { id:'upload',    label:'Upload',               icon:<IconUpload /> },
  ]

  const titles = {
    dashboard: 'Pulpit',
    portfolio: 'Portfolio publiczne',
    albums:    'Albumy klientów',
    photos:    'Wszystkie zdjęcia',
    upload:    'Upload do portfolio',
    albumManage: manageAlbum?.name || 'Album',
  }

  return (
    <div className="page">
      <nav className="nav">
        <Link to="/" className="nav-logo">Adam Rędzikowski</Link>
        <div className="nav-links">
          <Link to="/" className="nav-link">← Galeria</Link>
          <button className="nav-link" onClick={logout} style={{ cursor:'pointer', background:'none', border:'none', color:'var(--text-2)' }}>
            Wyloguj
          </button>
        </div>
      </nav>

      <div className="admin-wrap">
        <aside className="admin-side">
          <p className="admin-side-title">Zarządzanie</p>
          {tabs.map(t => (
            <button key={t.id} className={`admin-nav-link ${tab === t.id ? 'active' : ''}`}
              onClick={() => navigate(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
          <div className="admin-nav-sep" />
          <button className="admin-nav-link" style={{ color:'var(--text-3)' }} onClick={logout}>Wyloguj</button>
        </aside>

        <main className="admin-main">
          <div className="admin-main-header">
            <h2 className="admin-main-title">{titles[tab]}</h2>
          </div>

          {tab === 'dashboard' && <TabDashboard onNavigate={navigate} />}
          {tab === 'portfolio' && <TabPortfolio />}
          {tab === 'albums'    && <TabAlbums onManage={manage} />}
          {tab === 'albumManage' && manageAlbum && (
            <TabAlbumManage album={manageAlbum} onBack={() => navigate('albums')} onAlbumUpdated={setManageAlbum} />
          )}
          {tab === 'photos'    && <TabPhotos />}
          {tab === 'upload'    && <TabUpload />}
        </main>
      </div>
    </div>
  )
}
