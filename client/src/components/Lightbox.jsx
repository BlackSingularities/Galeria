import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { fileUrl, thumbUrl, createAlbumShare } from '../api'
import { useToast } from './Feedback'
import {
  IconClose, IconPrev, IconNext, IconZoomIn, IconZoomOut, IconDownload,
  IconInfo, IconShare, IconPlay, IconPause, IconFullscreen, IconExitFullscreen,
  IconCamera, IconAperture, IconClock, IconCalendar, IconLayers,
} from './icons'

function fmtBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function fmtDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return null }
}

const SLIDESHOW_MS = 4200

export default function Lightbox({
  photos, index: initIndex, onClose, onIndexChange, mediaToken = null,
  allowShareDownload = false, albumSlug = null, protectedPublic = false,
}) {
  const [idx, setIdx]     = useState(initIndex ?? 0)
  const [zoom, setZoom]   = useState(false)
  const [fade, setFade]   = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [shareExpiresIn, setShareExpiresIn] = useState('7d')
  const thumbRef = useRef(null)
  const backdropRef = useRef(null)
  const toast = useToast()
  const total = photos.length
  const photo = photos[idx]

  const megapixels = useMemo(() => {
    if (!photo?.width || !photo?.height) return null
    return (photo.width * photo.height / 1_000_000).toFixed(1)
  }, [photo])

  const go = useCallback((next) => {
    setFade(false); setLoaded(false)
    setTimeout(() => {
      setIdx(next); setZoom(false); setFade(true)
      onIndexChange?.(next)
    }, 150)
  }, [onIndexChange])
  const prev = useCallback(() => go((idx - 1 + total) % total), [go, idx, total])
  const next = useCallback(() => go((idx + 1) % total), [go, idx, total])

  // Preload the neighbouring full-resolution images so navigation feels instant.
  useEffect(() => {
    const mediaSrc = (p) => protectedPublic ? thumbUrl(p.thumb, mediaToken) : fileUrl(p.filename, mediaToken)
    const preload = (i) => { const p = photos[i]; if (p) { const img = new Image(); img.src = mediaSrc(p) } }
    preload((idx + 1) % total)
    preload((idx - 1 + total) % total)
  }, [idx, total, photos, mediaToken, protectedPublic])

  useEffect(() => {
    const handler = (e) => {
      if (['ArrowLeft', 'ArrowRight', ' ', 'i', 'I', 'f', 'F', 'z', 'Z', 'Home', 'End'].includes(e.key)) e.preventDefault()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape')     onClose()
      if (e.key === 'z' || e.key === 'Z') setZoom(v => !v)
      if (e.key === 'i' || e.key === 'I') setShowInfo(v => !v)
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === ' ' && total > 1) setPlaying(v => !v)
      if (e.key === 'Home') go(0)
      if (e.key === 'End') go(total - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose, go, total])

  useEffect(() => {
    backdropRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(next, SLIDESHOW_MS)
    return () => clearInterval(t)
  }, [playing, idx, next])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) backdropRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.()
  }

  // Scroll active thumb into view
  useEffect(() => {
    const el = thumbRef.current?.querySelector('.lb-thumb.active')
    el?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
  }, [idx])

  // Touch swipe
  const touchStart = useRef(null)
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd   = (e) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(dx) > 50) { setPlaying(false); dx < 0 ? next() : prev() }
    touchStart.current = null
  }

  const photoTitle = photo.display_name || photo.original_name || 'Zdjęcie'

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = fileUrl(photo.filename, mediaToken)
    a.download = photo.display_name || photo.original_name || photo.filename
    a.click()
  }

  const handleShare = async () => {
    try {
      const share = albumSlug ? await createAlbumShare(albumSlug, shareExpiresIn, mediaToken) : { token: mediaToken }
      const url = new URL(window.location.href)
      url.searchParams.set('photo', photo.id)
      if (share.token) url.searchParams.set('t', share.token)
      else url.searchParams.delete('t')
      const shareUrl = url.toString()
      if (navigator.share) {
        try { await navigator.share({ title: photoTitle, url: shareUrl }) } catch {}
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      toast.success(share.token ? 'Link do zdjęcia skopiowany' : 'Publiczny link do zdjęcia skopiowany')
    } catch {
      toast.error('Nie udało się przygotować linku')
    }
  }

  const hasExif = photo.camera_make || photo.camera_model || photo.lens || photo.aperture || photo.shutter_speed || photo.iso || photo.focal_length
  const takenDate = fmtDate(photo.taken_at)
  const uploadDate = fmtDate(photo.created_at)

  return (
    <div
      className={`lb-backdrop ${protectedPublic ? 'public-protected' : ''}`}
      ref={backdropRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={photoTitle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onContextMenu={protectedPublic ? (e) => e.preventDefault() : undefined}
      onCopy={protectedPublic ? (e) => e.preventDefault() : undefined}
    >
      {/* Top bar */}
      <div className="lb-bar">
        <div className="lb-bar-left">
          <span className="lb-counter">{idx + 1} / {total}</span>
          <span className="lb-filename">{photoTitle}</span>
          {photo.width && <span className="lb-filename lb-filename-meta">{photo.width} × {photo.height}{megapixels && ` · ${megapixels} MP`} · {fmtBytes(photo.file_size)}</span>}
        </div>
        <div className="lb-bar-right">
          {total > 1 && (
            <button className={`lb-btn ${playing ? 'active' : ''}`} onClick={() => setPlaying(v => !v)} title={playing ? 'Zatrzymaj pokaz (Spacja)' : 'Pokaz slajdów (Spacja)'}>
              {playing ? <IconPause /> : <IconPlay />}
            </button>
          )}
          <button className={`lb-btn ${showInfo ? 'active' : ''}`} onClick={() => setShowInfo(v => !v)} title="Szczegóły (I)">
            <IconInfo />
          </button>
          {allowShareDownload && (
            <>
              <select
                className="lb-share-expiry"
                value={shareExpiresIn}
                onChange={e => setShareExpiresIn(e.target.value)}
                title="Ważność linku"
              >
                <option value="1h">1 h</option>
                <option value="24h">24 h</option>
                <option value="7d">7 dni</option>
                <option value="30d">30 dni</option>
              </select>
              <button className="lb-btn" onClick={handleShare} title="Udostępnij">
                <IconShare />
              </button>
            </>
          )}
          <button className={`lb-btn ${zoom ? 'active' : ''}`} onClick={() => setZoom(v => !v)} title="Zoom 1:1 (Z)">
            {zoom ? <IconZoomOut /> : <IconZoomIn />}
          </button>
          <button className="lb-btn lb-btn-hide-mobile" onClick={toggleFullscreen} title="Pełny ekran (F)">
            {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
          </button>
          {allowShareDownload && (
            <button className="lb-btn" onClick={handleDownload} title="Pobierz oryginał">
              <IconDownload />
            </button>
          )}
          <button className="lb-btn" onClick={onClose} title="Zamknij (Esc)">
            <IconClose />
          </button>
        </div>
      </div>

      {/* Main stage */}
      <div className="lb-body">
        <div
          className={`lb-stage ${zoom ? 'zoom-mode' : ''}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={zoom ? () => setZoom(false) : undefined}
        >
          {total > 1 && !zoom && (
            <>
              <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); setPlaying(false); prev() }} disabled={total <= 1} aria-label="Poprzednie zdjęcie">
                <IconPrev />
              </button>
              <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); setPlaying(false); next() }} disabled={total <= 1} aria-label="Następne zdjęcie">
                <IconNext />
              </button>
            </>
          )}

          {photo.blur_data_url && (
            <img src={photo.blur_data_url} alt="" aria-hidden className="lb-img-blur" style={{ opacity: loaded ? 0 : 1 }} draggable={false} />
          )}
          {!loaded && <div className="lb-spinner" />}

          <img
            key={photo.id}
            src={protectedPublic ? thumbUrl(photo.thumb, mediaToken) : fileUrl(photo.filename, mediaToken)}
            alt={photo.display_name || ''}
            className="lb-img"
            style={{
              opacity: fade && loaded ? 1 : 0,
              transition: 'opacity .25s ease',
              ...(zoom ? { width: photo.width, height: photo.height, maxWidth: 'none', maxHeight: 'none' } : {}),
            }}
            onLoad={() => setLoaded(true)}
            onClick={!zoom ? (e) => { e.stopPropagation(); setPlaying(false); next() } : undefined}
            draggable={false}
          />
        </div>

        {/* Details panel */}
        <aside className={`lb-info ${showInfo ? 'open' : ''}`} aria-hidden={!showInfo}>
          <div className="lb-info-inner">
            <h3 className="lb-info-title">{photoTitle}</h3>
            {photo.album_name && <p className="lb-info-album">{photo.album_name}</p>}

            <div className="lb-info-section">
              <div className="lb-info-row"><IconLayers /><span>{photo.width} × {photo.height}px{megapixels && ` · ${megapixels} MP`}</span></div>
              <div className="lb-info-row"><IconLayers /><span>{fmtBytes(photo.file_size)}{photo.original_quality ? ' · oryginał 1:1' : ''}</span></div>
              {uploadDate && <div className="lb-info-row"><IconCalendar /><span>Dodano {uploadDate}</span></div>}
            </div>

            {hasExif && (
              <div className="lb-info-section">
                <p className="lb-info-heading">Aparat</p>
                {(photo.camera_make || photo.camera_model) && (
                  <div className="lb-info-row"><IconCamera /><span>{[photo.camera_make, photo.camera_model].filter(Boolean).join(' ')}</span></div>
                )}
                {photo.lens && <div className="lb-info-row"><IconAperture /><span>{photo.lens}</span></div>}
                {(photo.aperture || photo.shutter_speed || photo.iso || photo.focal_length) && (
                  <div className="lb-info-row lb-info-tags">
                    {photo.focal_length && <span className="tag">{photo.focal_length}</span>}
                    {photo.aperture && <span className="tag">{photo.aperture}</span>}
                    {photo.shutter_speed && <span className="tag">{photo.shutter_speed}</span>}
                    {photo.iso && <span className="tag">ISO {photo.iso}</span>}
                  </div>
                )}
                {takenDate && <div className="lb-info-row"><IconClock /><span>Wykonano {takenDate}</span></div>}
              </div>
            )}

            {allowShareDownload && (
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={handleDownload}>
                <IconDownload /> Pobierz oryginał
              </button>
            )}

          </div>
        </aside>
      </div>

      {/* Thumbnails */}
      {total > 1 && (
        <div className="lb-thumbs" ref={thumbRef}>
          {photos.map((p, i) => (
            <img
              key={p.id}
              src={thumbUrl(p.thumb, mediaToken) || fileUrl(p.filename, mediaToken)}
              alt=""
              className={`lb-thumb ${i === idx ? 'active' : ''}`}
              onClick={() => { setPlaying(false); go(i) }}
              draggable={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
