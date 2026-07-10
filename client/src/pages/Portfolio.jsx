import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPortfolio, fileUrl } from '../api'
import Grid from '../components/Grid'
import SkeletonGrid from '../components/SkeletonGrid'
import BackToTop from '../components/BackToTop'
import { setPageMeta } from '../lib/seo'
import { IconImage } from '../components/icons'

export default function Portfolio() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setPageMeta({
      title: 'Adam Rędzikowski — Galeria fotograficzna',
      description: 'Portfolio fotograficzne Adam Rędzikowski — wybrane prace, śluby, portrety i plenery.',
    })
    getPortfolio()
      .then(setPhotos)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <a href="/" className="nav-logo">Adam Rędzikowski</a>
        <div className="nav-links">
          <Link to="/" className="nav-link active">Portfolio</Link>
          <Link to="/admin" className="nav-link admin-link">Admin</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="hero">
        <div
          className={`hero-bg ${photos[0] ? 'has-image' : ''}`}
          style={photos[0] ? { backgroundImage: `url(${fileUrl(photos[0].filename)})` } : undefined}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-label">Fotografia</p>
          <h1 className="hero-title">
            Zamrożone<br /><em>chwile</em>
          </h1>
        </div>
      </div>

      {/* Grid */}
      <div className="section-wrap">
        <div className="section-heading-row">
          <div>
            <p className="section-label">Portfolio fotograficzne</p>
            <h2 className="section-heading">
              Wybrane<br /><em>prace</em>
            </h2>
          </div>
          {!loading && photos.length > 0 && (
            <span className="section-count">{photos.length} {photos.length === 1 ? 'zdjęcie' : photos.length < 5 ? 'zdjęcia' : 'zdjęć'}</span>
          )}
        </div>

        {loading ? (
          <SkeletonGrid count={12} />
        ) : error ? (
          <div className="empty-state">
            <IconImage width={40} height={40} style={{ opacity: .3, margin: '0 auto' }} />
            <p>Nie udało się wczytać galerii. Spróbuj odświeżyć stronę.</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="empty-state">
            <IconImage width={40} height={40} style={{ opacity: .3, margin: '0 auto' }} />
            <p style={{ marginTop: 12 }}>
              Portfolio jeszcze w budowie.<br />
              <Link to="/admin" style={{ color:'var(--gold)' }}>Dodaj pierwsze zdjęcia →</Link>
            </p>
          </div>
        ) : (
          <Grid photos={photos} syncUrl />
        )}
      </div>

      {/* Footer */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span style={{ color:'var(--text-3)', fontSize:13 }}>
            © {new Date().getFullYear()} Adam Rędzikowski
          </span>
          <a href="mailto:redzikowskia@gmail.com" style={{ color:'var(--gold)', fontSize:13 }}>
            redzikowskia@gmail.com
          </a>
        </div>
      </footer>

      <BackToTop />
    </div>
  )
}
