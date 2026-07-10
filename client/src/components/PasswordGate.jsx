import { useState } from 'react'
import { Link } from 'react-router-dom'
import { verifyAlbum } from '../api'
import { IconLock } from './icons'

export default function PasswordGate({ slug, albumName, onUnlock }) {
  const [pass, setPass]     = useState('')
  const [show, setShow]     = useState(false)
  const [error, setError]   = useState('')
  const [shake, setShake]   = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!pass.trim()) return
    setError(''); setLoading(true)
    try {
      const { token } = await verifyAlbum(slug, pass.trim())
      onUnlock(token)
    } catch (err) {
      setError(err.message || 'Błąd')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="gate-wrap">
      <div className={`gate-box ${shake ? 'shake' : ''}`}>
        <div className="gate-icon"><IconLock width={28} height={28} /></div>
        <h2 className="gate-title">{albumName || 'Album prywatny'}</h2>
        <p className="gate-desc">Podaj hasło, aby zobaczyć zdjęcia.</p>
        <form onSubmit={submit}>
          <div className="field">
            <div className="input-with-action">
              <input
                type={show ? 'text' : 'password'}
                className="input"
                placeholder="Hasło do albumu"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoFocus
              />
              <button type="button" className="input-action" onClick={() => setShow(v => !v)} tabIndex={-1}>
                {show ? 'Ukryj' : 'Pokaż'}
              </button>
            </div>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn" style={{ width:'100%', marginTop:8 }} disabled={loading}>
            {loading ? 'Sprawdzam…' : 'Wejdź'}
          </button>
        </form>
        <div style={{ marginTop:24, borderTop:'1px solid var(--border-2)', paddingTop:20 }}>
          <Link to="/" style={{ fontSize:13, color:'var(--text-3)' }}>← Wróć do portfolio</Link>
        </div>
      </div>
    </div>
  )
}
