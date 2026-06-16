import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPortfolio } from '../api'
import Grid from '../components/Grid'

export default function Portfolio() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPortfolio()
      .then(setPhotos)
      .catch(console.error)
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
        <div className="hero-bg" />
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
        <p className="section-label">Portfolio fotograficzne</p>
        <h2 className="section-heading" style={{ marginBottom: 32 }}>
          Wybrane<br /><em>prace</em>
        </h2>

        {loading ? (
          <div className="spinner" />
        ) : (
          <Grid photos={photos} />
        )}

        {!loading && photos.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: '3rem', opacity: .3 }}>📷</div>
            <p style={{ marginTop: 12 }}>
              Portfolio jeszcze w budowie.<br />
              <Link to="/admin" style={{ color:'var(--gold)' }}>Dodaj pierwsze zdjęcia →</Link>
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop:'1px solid var(--border-2)', padding:'32px 60px', marginTop:60 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'var(--text-3)', fontSize:13 }}>
            © {new Date().getFullYear()} Adam Rędzikowski
          </span>
          <a href="mailto:redzikowskia@gmail.com" style={{ color:'var(--gold)', fontSize:13 }}>
            redzikowskia@gmail.com
          </a>
        </div>
      </footer>
    </div>
  )
}
