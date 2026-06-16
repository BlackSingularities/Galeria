import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAlbum } from '../api'
import Grid from '../components/Grid'
import PasswordGate from '../components/PasswordGate'

const TOKEN_KEY = (slug) => `album_token_${slug}`

export default function Album() {
  const { slug } = useParams()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsPass, setNeedsPass] = useState(false)
  const [albumName, setAlbumName] = useState('')

  const load = async (token) => {
    setLoading(true)
    try {
      const d = await getAlbum(slug, token)
      setData(d)
      setNeedsPass(false)
    } catch (err) {
      if (err.status === 401) {
        setNeedsPass(true)
        // try to get album name from error or just show slug
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY(slug))
    load(saved || localStorage.getItem('admin_token'))
  }, [slug])

  const handleUnlock = (token) => {
    if (token) sessionStorage.setItem(TOKEN_KEY(slug), token)
    load(token)
  }

  if (loading) return (
    <div className="page">
      <nav className="nav">
        <Link to="/" className="nav-logo">Adam Rędzikowski</Link>
      </nav>
      <div className="spinner" />
    </div>
  )

  if (needsPass) return (
    <div className="page" style={{ paddingTop: 0 }}>
      <PasswordGate slug={slug} albumName={albumName || slug} onUnlock={handleUnlock} />
    </div>
  )

  if (!data) return (
    <div className="page">
      <nav className="nav">
        <Link to="/" className="nav-logo">Adam Rędzikowski</Link>
      </nav>
      <div className="empty-state" style={{ paddingTop: 120 }}>
        <p>Album nie istnieje.</p>
        <Link to="/" style={{ color:'var(--gold)', fontSize:13 }}>← Wróć do portfolio</Link>
      </div>
    </div>
  )

  const { album, photos } = data

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <Link to="/" className="nav-logo">Adam Rędzikowski</Link>
        <div className="nav-links">
          <Link to="/" className="nav-link">← Portfolio</Link>
        </div>
      </nav>

      {/* Header */}
      <div className="section-wrap" style={{ paddingBottom: 32 }}>
        <p className="section-label">Album</p>
        <h1 className="section-heading" style={{ marginBottom: album.description ? 12 : 32 }}>
          {album.name}
        </h1>
        {album.description && (
          <p style={{ color:'var(--text-2)', maxWidth:600, marginBottom:32 }}>
            {album.description}
          </p>
        )}
        <p style={{ color:'var(--text-3)', fontSize:13 }}>
          {photos.length} {photos.length === 1 ? 'zdjęcie' : photos.length < 5 ? 'zdjęcia' : 'zdjęć'}
        </p>
      </div>

      {/* Grid */}
      <div style={{ padding:'0 60px 80px' }}>
        <Grid photos={photos} />
      </div>
    </div>
  )
}
