import { useState } from 'react'
import { verifyAlbum } from '../api'

export default function PasswordGate({ slug, albumName, onUnlock }) {
  const [pass, setPass]     = useState('')
  const [error, setError]   = useState('')
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="gate-wrap">
      <div className="gate-box">
        <div className="gate-icon">🔒</div>
        <h2 className="gate-title">{albumName || 'Album prywatny'}</h2>
        <p className="gate-desc">Podaj hasło, aby zobaczyć zdjęcia.</p>
        <form onSubmit={submit}>
          <div className="field">
            <input
              type="password"
              className="input"
              placeholder="Hasło do albumu"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn" style={{ width:'100%', marginTop:8 }} disabled={loading}>
            {loading ? 'Sprawdzam…' : 'Wejdź'}
          </button>
        </form>
        <div style={{ marginTop:24, borderTop:'1px solid var(--border-2)', paddingTop:20 }}>
          <a href="../" style={{ fontSize:13, color:'var(--text-3)' }}>← Wróć do portfolio</a>
        </div>
      </div>
    </div>
  )
}
