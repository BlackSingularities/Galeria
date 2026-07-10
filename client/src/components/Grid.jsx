import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Lightbox from './Lightbox'
import { thumbUrl, fileUrl } from '../api'
import { IconCheck, IconTrash, IconImage, IconGrip, IconStar } from './icons'

function PhotoImg({ photo, mediaToken }) {
  const [loaded, setLoaded] = useState(false)
  const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : '4 / 3'
  return (
    <div className="photo-item-frame" style={{ aspectRatio: ratio }}>
      {photo.blur_data_url && (
        <img src={photo.blur_data_url} alt="" aria-hidden className="photo-item-blur" style={{ opacity: loaded ? 0 : 1 }} />
      )}
      <img
        src={thumbUrl(photo.thumb, mediaToken) || fileUrl(photo.filename, mediaToken)}
        alt={photo.original_name || ''}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </div>
  )
}

export default function Grid({
  photos, adminMode = false, selectable = false, selected = [], onSelect, onDelete, syncUrl = false,
  reorderable = false, onReorder, onSetCover, onTogglePortfolio, mediaToken = null,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const dragFrom = useRef(null)
  const [dragOver, setDragOver] = useState(null)
  const [lightboxIdx, setLightboxIdx] = useState(() => {
    if (!syncUrl) return null
    const pid = searchParams.get('photo')
    if (!pid) return null
    const i = photos.findIndex(p => String(p.id) === pid)
    return i >= 0 ? i : null
  })
  const openedFromUrl = useRef(lightboxIdx !== null)

  useEffect(() => {
    if (!openedFromUrl.current) return
    const el = document.querySelector(`[data-photo-id="${photos[lightboxIdx]?.id}"]`)
    el?.scrollIntoView({ block: 'center' })
    openedFromUrl.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openLightbox = (i) => {
    setLightboxIdx(i)
    if (syncUrl) {
      const sp = new URLSearchParams(searchParams)
      sp.set('photo', photos[i].id)
      setSearchParams(sp, { replace: true })
    }
  }
  const closeLightbox = () => {
    setLightboxIdx(null)
    if (syncUrl) {
      const sp = new URLSearchParams(searchParams)
      sp.delete('photo')
      setSearchParams(sp, { replace: true })
    }
  }
  const changeIndex = (i) => {
    if (syncUrl) {
      const sp = new URLSearchParams(searchParams)
      sp.set('photo', photos[i].id)
      setSearchParams(sp, { replace: true })
    }
  }

  const handleDragStart = (i) => (e) => {
    dragFrom.current = i
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (i) => (e) => {
    e.preventDefault()
    if (dragOver !== i) setDragOver(i)
  }
  const handleDrop = (i) => (e) => {
    e.preventDefault()
    const from = dragFrom.current
    dragFrom.current = null
    setDragOver(null)
    if (from === null || from === i) return
    const next = [...photos]
    const [moved] = next.splice(from, 1)
    next.splice(i, 0, moved)
    onReorder?.(next.map(p => p.id))
  }

  if (!photos?.length) {
    return (
      <div className="empty-state">
        <IconImage width={40} height={40} style={{ opacity: .3, margin: '0 auto' }} />
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
            data-photo-id={photo.id}
            className={`photo-item ${photo.is_portfolio ? 'is-portfolio' : ''} ${selected.includes(photo.id) ? 'selected' : ''} ${dragOver === i ? 'drag-over' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={photo.original_name || 'Otwórz zdjęcie'}
            draggable={reorderable}
            onDragStart={reorderable ? handleDragStart(i) : undefined}
            onDragOver={reorderable ? handleDragOver(i) : undefined}
            onDragEnd={() => { dragFrom.current = null; setDragOver(null) }}
            onDrop={reorderable ? handleDrop(i) : undefined}
            onClick={() => {
              if (selectable && onSelect) onSelect(photo.id)
              else openLightbox(i)
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              if (selectable && onSelect) onSelect(photo.id)
              else openLightbox(i)
            }}
          >
            <PhotoImg photo={photo} mediaToken={mediaToken} />
            <div className="photo-item-overlay" />
            <div className="photo-item-info">
              {photo.original_name && <div className="photo-item-name">{photo.original_name}</div>}
              {(photo.camera_model || photo.taken_at) && (
                <div className="photo-item-meta">
                  {[photo.camera_model, photo.taken_at && new Date(photo.taken_at).getFullYear()].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            {reorderable && <div className="photo-item-grip"><IconGrip /></div>}
            {photo.is_cover ? <div className="photo-item-cover-badge" title="Okładka albumu"><IconStar /></div> : null}
            {adminMode && (
              <>
                {selectable && (
                  <div className="photo-item-check">
                    {selected.includes(photo.id) && <IconCheck />}
                  </div>
                )}
                <div className="photo-item-actions">
                  {onSetCover && !photo.is_cover && (
                    <button
                      className="btn btn-ghost btn-sm photo-item-action"
                      onClick={(e) => { e.stopPropagation(); onSetCover(photo) }}
                      title="Ustaw jako okładkę albumu"
                    >
                      <IconStar />
                    </button>
                  )}
                  {onTogglePortfolio && (
                    <button
                      className={`btn btn-sm photo-item-action ${photo.is_portfolio ? '' : 'btn-ghost'}`}
                      onClick={(e) => { e.stopPropagation(); onTogglePortfolio(photo) }}
                      title={photo.is_portfolio ? 'Usuń z portfolio' : 'Dodaj do portfolio'}
                    >
                      <IconStar />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="btn btn-danger btn-sm photo-item-action"
                      onClick={(e) => { e.stopPropagation(); onDelete(photo.id) }}
                      title="Usuń"
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIdx}
          onClose={closeLightbox}
          onIndexChange={changeIndex}
          mediaToken={mediaToken}
        />
      )}
    </>
  )
}
