import { Link } from 'react-router-dom'
import { IconImage } from '../components/icons'

export default function NotFound() {
  return (
    <div className="page">
      <nav className="nav">
        <Link to="/" className="nav-logo">Adam Rędzikowski</Link>
      </nav>
      <div className="empty-state" style={{ paddingTop: 140 }}>
        <IconImage width={40} height={40} style={{ opacity: .3, margin: '0 auto' }} />
        <p className="not-found-code">404</p>
        <p>Ta strona nie istnieje.</p>
        <Link to="/" style={{ color:'var(--gold)', fontSize:13 }}>← Wróć do portfolio</Link>
      </div>
    </div>
  )
}
