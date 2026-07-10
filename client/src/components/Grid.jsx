import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Lightbox from './Lightbox'
import { thumbUrl, fileUrl } from '../api'
import { IconCheck, IconTrash, IconImage, IconGrip, IconStar, IconEdit } from './icons'

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
        alt={photo.display_name || ''}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
        draggable={false}
      />
    </div>
  )
}

const BATCH_SIZE = 24

export default function Grid({
  photos, adminMode = false, selectable = false, selected = [], onSelect, onDelete, syncUrl = false,
  reorderable = false, onReorder, onSetCover, onTogglePortfolio, onEditPhoto, mediaToken = null,
  infiniteScroll = !reorderable, allowShareDownload = false, albumSlug = null, protectedPublic = false,
  tileSizeStorageKey = 'gallery_tile_size', showTileSizeControl = true,
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
  const [tileSize, setTileSize] = useState(() => localStorage.getItem(tileSizeStorageKey) || 'medium')
  const [columnCount, setColumnCount] = useState(3)

  // Render photos in growing batches instead of all at once — keeps the
  // initial paint light and defers offscreen images (native loading="lazy"
  // only helps once an <img> exists in the DOM at all).
  const [visibleCount, setVisibleCount] = useState(() => {
    if (!infiniteScroll) return photos.length
    const initial = lightboxIdx !== null ? lightboxIdx + 1 : 0
    return Math.min(Math.max(BATCH_SIZE, initial), photos.length)
  })
  const sentinelRef = useRef(null)

  useEffect(() => {
    setVisibleCount(infiniteScroll ? Math.min(BATCH_SIZE, photos.length) : photos.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, infiniteScroll])

  useEffect(() => {
    if (!infiniteScroll || visibleCount >= photos.length) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(v => Math.min(v + BATCH_SIZE, photos.length))
      }
    }, { rootMargin: '900px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [infiniteScroll, visibleCount, photos.length])

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth
      if (width <= 640) return setColumnCount(1)
      if (width <= 1100) return setColumnCount(2)
      setColumnCount(tileSize === 'small' ? 4 : tileSize === 'large' ? 2 : 3)
    }
    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [tileSize])

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

  const visiblePhotos = infiniteScroll ? photos.slice(0, visibleCount) : photos
  const updateTileSize = (size) => {
    setTileSize(size)
    localStorage.setItem(tileSizeStorageKey, size)
  }
  const showTileInfo = !selectable
  const stableMasonry = infiniteScroll && !reorderable
  const masonryColumns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }))
  if (stableMasonry) {
    visiblePhotos.forEach((photo, index) => {
      const ratio = photo.width && photo.height ? photo.height / photo.width : 0.75
      const target = masonryColumns.reduce((min, col, i) => col.height < masonryColumns[min].height ? i : min, 0)
      masonryColumns[target].items.push({ photo, index })
      masonryColumns[target].height += ratio
    })
  }

  const renderPhotoCard = (photo, i) => (
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
      onContextMenu={protectedPublic ? (e) => e.preventDefault() : undefined}
      onCopy={protectedPublic ? (e) => e.preventDefault() : undefined}
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
      {showTileInfo && (photo.display_name || photo.camera_model || photo.taken_at) && (
        <div className="photo-item-info">
          {photo.display_name && <div className="photo-item-name">{photo.display_name}</div>}
          {(photo.camera_model || photo.taken_at) && (
            <div className="photo-item-meta">
              {[photo.camera_model, photo.taken_at && new Date(photo.taken_at).getFullYear()].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}
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
            {onEditPhoto && (
              <button
                className="btn btn-ghost btn-sm photo-item-action"
                onClick={(e) => { e.stopPropagation(); onEditPhoto(photo) }}
                title="Edytuj dane zdjęcia"
              >
                <IconEdit />
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
  )

  return (
    <>
      {showTileSizeControl && (
        <div className="grid-toolbar">
          <span className="grid-toolbar-label">Wielkość kafelków</span>
          <div className="grid-size-buttons" role="group" aria-label="Wielkość kafelków">
            {[
              ['small', 'Małe'],
              ['medium', 'Średnie'],
              ['large', 'Duże'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`btn btn-sm ${tileSize === value ? '' : 'btn-ghost'}`}
                onClick={() => updateTileSize(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={`photo-grid ${stableMasonry ? 'stable-masonry' : ''} tile-${tileSize} ${protectedPublic ? 'public-protected' : ''}`}
        style={stableMasonry ? { '--masonry-columns': columnCount } : undefined}
      >
        {stableMasonry
          ? masonryColumns.map((column, columnIndex) => (
            <div className="photo-column" key={columnIndex}>
              {column.items.map(({ photo, index }) => renderPhotoCard(photo, index))}
            </div>
          ))
          : visiblePhotos.map((photo, i) => renderPhotoCard(photo, i))}
      </div>

      {infiniteScroll && visibleCount < photos.length && (
        <div ref={sentinelRef} className="grid-sentinel" />
      )}

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIdx}
          onClose={closeLightbox}
          onIndexChange={changeIndex}
          mediaToken={mediaToken}
          allowShareDownload={allowShareDownload}
          albumSlug={albumSlug}
          protectedPublic={protectedPublic}
        />
      )}
    </>
  )
}
