import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAlbum } from '../api'
import Grid from '../components/Grid'
import SkeletonGrid from '../components/SkeletonGrid'
import BackToTop from '../components/BackToTop'
import PasswordGate from '../components/PasswordGate'
import { setPageMeta } from '../lib/seo'
import { IconImage } from '../components/icons'

const TOKEN_KEY = (slug) => `album_token_${slug}`

function Nav() {
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">Adam Rędzikowski</Link>
      <div className="nav-links">
        <Link to="/" className="nav-link">← Portfolio</Link>
      </div>
    </nav>
  )
}

export default function Album() {
  const { slug } = useParams()
  const [data, setData]     = useState(null)
  const [mediaToken, setMediaToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsPass, setNeedsPass] = useState(false)
  const [albumName, setAlbumName] = useState('')
  const [notFound, setNotFound] = useState(false)

  const load = async (token) => {
    setLoading(true)
    try {
      const d = await getAlbum(slug, token)
      setData(d)
      setMediaToken(token || null)
      setNeedsPass(false)
      setPageMeta({
        title: `${d.album.name} — Adam Rędzikowski`,
        description: d.album.description || `Album zdjęć: ${d.album.name}`,
      })
    } catch (err) {
      if (err.status === 401) {
        setNeedsPass(true)
        if (err.albumName) setAlbumName(err.albumName)
      } else if (err.status === 404) {
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY(slug))
    load(saved || localStorage.getItem('admin_token'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const handleUnlock = (token) => {
    if (token) sessionStorage.setItem(TOKEN_KEY(slug), token)
    load(token)
  }

  if (loading) return (
    <div className="page">
      <Nav />
      <div className="section-wrap">
        <SkeletonGrid count={9} />
      </div>
    </div>
  )

  if (needsPass) return (
    <div className="page" style={{ paddingTop: 0 }}>
      <PasswordGate slug={slug} albumName={albumName || slug} onUnlock={handleUnlock} />
    </div>
  )

  if (notFound || !data) return (
    <div className="page">
      <Nav />
      <div className="empty-state" style={{ paddingTop: 120 }}>
        <IconImage width={40} height={40} style={{ opacity: .3, margin: '0 auto' }} />
        <p>Ten album nie istnieje lub został usunięty.</p>
        <Link to="/" style={{ color:'var(--gold)', fontSize:13 }}>← Wróć do portfolio</Link>
      </div>
    </div>
  )

  const { album, photos } = data

  return (
    <div className="page">
      <Nav />

      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        <Link to="/">Portfolio</Link>
        <span>/</span>
        <span className="breadcrumbs-current">{album.name}</span>
      </div>

      {/* Header */}
      <div className="section-wrap" style={{ paddingTop: 24, paddingBottom: 32 }}>
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
        <Grid photos={photos} syncUrl mediaToken={mediaToken} />
      </div>

      <BackToTop />
    </div>
  )
}
