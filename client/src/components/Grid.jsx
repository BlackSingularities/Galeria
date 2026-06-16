import { useState } from 'react'
import Lightbox from './Lightbox'
import { thumbUrl, fileUrl } from '../api'

export default function Grid({ photos, adminMode = false, selected = [], onSelect, onDelete }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)

  if (!photos?.length) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '3rem', opacity: .3 }}>📷</div>
        <p>Brak zdjęć</p>
      </div>
    )
  }

  return (
    <>
      <div className="photo-grid">
        {photos.map((photo, i) => (
          <div
            key={photo.id}
            className={`photo-item ${photo.is_portfolio ? 'is-portfolio' : ''} ${selected.includes(photo.id) ? 'selected' : ''}`}
            onClick={() => {
              if (adminMode && onSelect) onSelect(photo.id)
              else setLightboxIdx(i)
            }}
          >
            <img
              src={thumbUrl(photo.thumb) || fileUrl(photo.filename)}
              alt={photo.original_name || ''}
              loading="lazy"
            />
            <div className="photo-item-overlay" />
            <div className="photo-item-info">
              {photo.original_name && <div style={{ fontWeight: 500 }}>{photo.original_name}</div>}
            </div>
            {adminMode && (
              <>
                <div className="photo-item-check">
                  {selected.includes(photo.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                {onDelete && (
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ position:'absolute', bottom:8, right:8, opacity:0, transition:'opacity .2s' }}
                    onClick={(e) => { e.stopPropagation(); onDelete(photo.id) }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                    title="Usuń"
                  >
                    ✕
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  )
}
