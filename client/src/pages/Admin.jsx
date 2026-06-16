import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  adminLogin, adminGetAlbums, adminCreateAlbum, adminUpdateAlbum, adminDeleteAlbum,
  adminGetPhotos, adminUpdatePhoto, adminDeletePhoto, adminUpload,
} from '../api'
import Grid from '../components/Grid'

// ── Auth ──────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pass, setPass]     = useState('')
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
      <div className="login-box">
        <div style={{ marginBottom:24 }}>
          <p style={{ color:'var(--gold)', fontSize:11, letterSpacing:'.15em', textTransform:'uppercase', marginBottom:8 }}>
            Panel administracyjny
          </p>
          <h1 className="login-title">Galeria</h1>
          <p className="login-sub">Podaj hasło administratora</p>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <input type="password" className="input" placeholder="Hasło" value={pass}
              onChange={e => setPass(e.target.value)} autoFocus />
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
  const [files, setFiles]       = useState([])
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [done, setDone]         = useState(false)
  const inputRef = useRef()
  const dragRef  = useRef(0)

  const add = (fl) => setFiles(prev => [...prev, ...Array.from(fl)])

  const onDrop = (e) => {
    e.preventDefault(); dragRef.current = 0
    e.currentTarget.classList.remove('drag-over')
    add(e.dataTransfer.files)
  }

  const upload = async () => {
    if (!files.length) return
    setUploading(true); setProgress(0)
    try {
      await adminUpload(albumId, files, setProgress)
      setDone(true); setFiles([])
      onDone?.()
    } catch (e) {
      alert('Błąd uploadu: ' + e.message)
    } finally {
      setUploading(false); setProgress(0)
    }
  }

  const fmtSize = (b) => b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`

  return (
    <div>
      <div
        className="dropzone"
        onClick={() => inputRef.current.click()}
        onDragEnter={(e) => { e.preventDefault(); if (++dragRef.current === 1) e.currentTarget.classList.add('drag-over') }}
        onDragLeave={(e) => { e.preventDefault(); if (--dragRef.current === 0) e.currentTarget.classList.remove('drag-over') }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="dropzone-icon">📂</div>
        <p className="dropzone-text">Kliknij lub przeciągnij zdjęcia tutaj</p>
        <p className="dropzone-hint">JPG, PNG, WEBP, TIFF · max 150 MB / plik · do 50 plików naraz</p>
        <input ref={inputRef} type="file" multiple accept="image/*" style={{ display:'none' }}
          onChange={e => add(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="upload-queue">
          {files.slice(0, 8).map((f, i) => (
            <div key={i} className="upload-item">
              <span className="upload-item-name">{f.name}</span>
              <span className="upload-item-size">{fmtSize(f.size)}</span>
              <button className="btn-ghost btn-sm" style={{ flexShrink:0 }}
                onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {files.length > 8 && <p style={{ color:'var(--text-3)', fontSize:12, padding:'0 4px' }}>…i {files.length-8} więcej</p>}
        </div>
      )}

      {uploading && (
        <div className="upload-progress" style={{ marginTop:12 }}>
          <div className="upload-progress-bar" style={{ width: `${progress*100}%` }} />
        </div>
      )}

      {done && <p style={{ color:'var(--gold)', fontSize:13, marginTop:8 }}>✓ Zdjęcia wgrane!</p>}

      {files.length > 0 && !uploading && (
        <button className="btn" style={{ marginTop:16 }} onClick={upload}>
          Wgraj {files.length} {files.length === 1 ? 'zdjęcie' : 'zdjęcia/ć'}
        </button>
      )}
    </div>
  )
}

// ── Album modal ───────────────────────────────────────────────────────────────
function AlbumModal({ album, onClose, onSave }) {
  const [name, setName]       = useState(album?.name || '')
  const [desc, setDesc]       = useState(album?.description || '')
  const [pass, setPass]       = useState(album?.password || '')
  const [loading, setLoading] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      if (album?.id) await adminUpdateAlbum(album.id, { name, description:desc, password:pass || null })
      else await adminCreateAlbum({ name, description:desc, password:pass || null })
      onSave()
    } catch (e) { alert(e.message) }
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
            <input className="input" type="text" placeholder="Brak hasła = album publiczny"
              value={pass} onChange={e => setPass(e.target.value)} />
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

// ── Tabs ──────────────────────────────────────────────────────────────────────
function TabPortfolio() {
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])

  const load = () => {
    adminGetPhotos()
      .then(d => setPhotos(d.filter(p => p.is_portfolio || !p.album_id)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const deletePhoto = async (id) => {
    if (!confirm('Usunąć zdjęcie i plik?')) return
    await adminDeletePhoto(id)
    setPhotos(p => p.filter(x => x.id !== id))
  }

  const togglePortfolio = async (id) => {
    const photo = photos.find(p => p.id === id)
    if (!photo) return
    await adminUpdatePhoto(id, { ...photo, is_portfolio: photo.is_portfolio ? 0 : 1 })
    load()
  }

  const bulkDelete = async () => {
    if (!confirm(`Usunąć ${selected.length} zdjęcia/ć?`)) return
    for (const id of selected) await adminDeletePhoto(id)
    setSelected([])
    load()
  }

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:24, alignItems:'center' }}>
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

      {loading ? <div className="spinner" /> : (
        <Grid
          photos={photos}
          adminMode
          selected={selected}
          onSelect={toggleSelect}
          onDelete={deletePhoto}
        />
      )}
    </div>
  )
}

function TabAlbums({ onOpenUpload }) {
  const [albums, setAlbums]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null) // null | 'new' | album object

  const load = () => {
    adminGetAlbums()
      .then(setAlbums)
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const del = async (album) => {
    if (!confirm(`Usunąć album „${album.name}" i wszystkie (${album.photo_count}) zdjęcia?`)) return
    await adminDeleteAlbum(album.id)
    load()
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
                <div className="album-card-name">{a.name}</div>
                <div className="album-card-meta">{a.photo_count} zdjęć · {new Date(a.created_at).toLocaleDateString('pl')}</div>
                <div className="album-card-badge">
                  {a.password ? '🔒 Prywatny' : '🌐 Publiczny'}
                </div>
                {a.password && <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:8 }}>Hasło: {a.password}</div>}
                <div style={{ marginBottom:10 }}>
                  <a href={`${BASE_URL}/album/${a.slug}`} target="_blank" rel="noreferrer"
                    style={{ fontSize:12, color:'var(--gold)' }}>
                    Podgląd →
                  </a>
                </div>
                <div className="album-card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => onOpenUpload(a)}>Upload</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(a)}>Edytuj</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(a)}>Usuń</button>
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

function TabUpload({ album }) {
  const [albums, setAlbums]   = useState([])
  const [selAlbum, setSelAlbum] = useState(album?.id || '')
  const [refreshKey, setRefreshKey] = useState(0)

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
        onDone={() => setRefreshKey(k => k+1)}
      />
    </div>
  )
}

function TabPhotos() {
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  const load = () => {
    adminGetPhotos().then(setPhotos).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const deletePhoto = async (id) => {
    if (!confirm('Usunąć zdjęcie i plik?')) return
    await adminDeletePhoto(id)
    setPhotos(p => p.filter(x => x.id !== id))
  }

  const togglePortfolio = async (photo) => {
    await adminUpdatePhoto(photo.id, { ...photo, is_portfolio: photo.is_portfolio ? 0 : 1 })
    load()
  }

  const filtered = filter === 'all' ? photos
    : filter === 'portfolio' ? photos.filter(p => p.is_portfolio)
    : photos.filter(p => !p.is_portfolio)

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {['all','portfolio','other'].map(v => (
          <button key={v} className={`btn btn-sm ${filter === v ? '' : 'btn-ghost'}`} onClick={() => setFilter(v)}>
            {v === 'all' ? `Wszystkie (${photos.length})` : v === 'portfolio' ? `Portfolio (${photos.filter(p=>p.is_portfolio).length})` : `Albumy (${photos.filter(p=>!p.is_portfolio).length})`}
          </button>
        ))}
      </div>
      <p style={{ color:'var(--text-3)', fontSize:12, marginBottom:16 }}>Kliknij ★ na zdjęciu by dodać/usunąć z portfolio publicznego.</p>

      {loading ? <div className="spinner" /> : (
        <div className="photo-grid">
          {filtered.map(photo => (
            <div key={photo.id} className={`photo-item ${photo.is_portfolio ? 'is-portfolio' : ''}`}>
              <img src={`${import.meta.env.BASE_URL.replace(/\/$/,'')+'/thumbs/'+photo.thumb}`} alt="" loading="lazy" />
              <div className="photo-item-overlay" />
              <div className="photo-item-info">
                {photo.album_name && <div style={{ fontSize:11, opacity:.7 }}>{photo.album_name}</div>}
                <div style={{ fontWeight:500, fontSize:12 }}>{photo.original_name}</div>
              </div>
              <div style={{ position:'absolute', top:6, right:6, display:'flex', gap:4 }}>
                <button
                  className={`lb-btn ${photo.is_portfolio ? 'active' : ''}`}
                  style={{ width:30, height:30, fontSize:12 }}
                  onClick={() => togglePortfolio(photo)}
                  title={photo.is_portfolio ? 'Usuń z portfolio' : 'Dodaj do portfolio'}
                >★</button>
                <button
                  className="lb-btn"
                  style={{ width:30, height:30 }}
                  onClick={() => deletePhoto(photo.id)}
                  title="Usuń"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Admin shell ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [token, setToken]  = useState(() => localStorage.getItem('admin_token'))
  const [tab, setTab]      = useState('portfolio')
  const [uploadAlbum, setUploadAlbum] = useState(null)

  const logout = () => {
    localStorage.removeItem('admin_token')
    setToken(null)
  }

  const openUpload = (album) => {
    setUploadAlbum(album)
    setTab('upload')
  }

  if (!token) return <LoginScreen onLogin={setToken} />

  const tabs = [
    { id:'portfolio', label:'Portfolio publiczne' },
    { id:'albums',    label:'Albumy klientów' },
    { id:'photos',    label:'Wszystkie zdjęcia' },
    { id:'upload',    label:'Upload' },
  ]

  const titles = {
    portfolio: 'Portfolio publiczne',
    albums:    'Albumy klientów',
    photos:    'Wszystkie zdjęcia',
    upload:    uploadAlbum ? `Upload → ${uploadAlbum.name}` : 'Upload do portfolio',
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
        {/* Sidebar */}
        <aside className="admin-side">
          <p className="admin-side-title">Zarządzanie</p>
          {tabs.map(t => (
            <button key={t.id} className={`admin-nav-link ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); if (t.id !== 'upload') setUploadAlbum(null) }}>
              {t.id === 'portfolio' && '★ '}
              {t.id === 'albums'   && '📁 '}
              {t.id === 'photos'   && '🖼 '}
              {t.id === 'upload'   && '⬆ '}
              {t.label}
            </button>
          ))}
          <div className="admin-nav-sep" />
          <button className="admin-nav-link" style={{ color:'var(--text-3)' }} onClick={logout}>Wyloguj</button>
        </aside>

        {/* Main */}
        <main className="admin-main">
          <div className="admin-main-header">
            <h2 className="admin-main-title">{titles[tab]}</h2>
          </div>

          {tab === 'portfolio' && <TabPortfolio />}
          {tab === 'albums'   && <TabAlbums onOpenUpload={openUpload} />}
          {tab === 'photos'   && <TabPhotos />}
          {tab === 'upload'   && <TabUpload album={uploadAlbum} />}
        </main>
      </div>
    </div>
  )
}
