import { useEffect, useRef, useState, useCallback } from 'react'
import { fileUrl, thumbUrl } from '../api'

const IconClose    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconPrev     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="15 18 9 12 15 6"/></svg>
const IconNext     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="9 18 15 12 9 6"/></svg>
const IconZoomIn   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
const IconDownload = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IconZoomOut  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>

function fmt(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(0)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}

export default function Lightbox({ photos, index: initIndex, onClose }) {
  const [idx, setIdx]   = useState(initIndex ?? 0)
  const [zoom, setZoom] = useState(false)
  const [fade, setFade] = useState(true)
  const thumbRef = useRef(null)
  const total = photos.length
  const photo = photos[idx]

  const go = useCallback((next) => {
    setFade(false)
    setTimeout(() => { setIdx(next); setZoom(false); setFade(true) }, 160)
  }, [])
  const prev = () => go((idx - 1 + total) % total)
  const next = () => go((idx + 1) % total)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape')     onClose()
      if (e.key === 'z' || e.key === 'Z') setZoom(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [idx, total]) // eslint-disable-line

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
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev()
    touchStart.current = null
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = fileUrl(photo.filename)
    a.download = photo.original_name || photo.filename
    a.click()
  }

  return (
    <div className="lb-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>

      {/* Top bar */}
      <div className="lb-bar">
        <div className="lb-bar-left">
          <span className="lb-counter">{idx + 1} / {total}</span>
          <span className="lb-filename">{photo.original_name || photo.filename}</span>
          {photo.width && <span className="lb-filename">{photo.width} × {photo.height} · {fmt(photo.file_size)}</span>}
        </div>
        <div className="lb-bar-right">
          <button className={`lb-btn ${zoom ? 'active' : ''}`} onClick={() => setZoom(v => !v)} title="Zoom 1:1 (Z)">
            {zoom ? <IconZoomOut /> : <IconZoomIn />}
          </button>
          <button className="lb-btn" onClick={handleDownload} title="Pobierz">
            <IconDownload />
          </button>
          <button className="lb-btn" onClick={onClose} title="Zamknij (Esc)">
            <IconClose />
          </button>
        </div>
      </div>

      {/* Main stage */}
      <div
        className={`lb-stage ${zoom ? 'zoom-mode' : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={zoom ? () => setZoom(false) : undefined}
      >
        {total > 1 && !zoom && (
          <>
            <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); prev() }} disabled={total <= 1}>
              <IconPrev />
            </button>
            <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); next() }} disabled={total <= 1}>
              <IconNext />
            </button>
          </>
        )}
        <img
          key={photo.filename}
          src={zoom ? fileUrl(photo.filename) : (thumbUrl(photo.thumb) || fileUrl(photo.filename))}
          alt={photo.original_name || ''}
          className="lb-img"
          style={{ opacity: fade ? 1 : 0, transition: 'opacity .16s ease',
            ...(zoom ? { width: photo.width, height: photo.height, maxWidth: 'none', maxHeight: 'none' } : {}) }}
          onClick={!zoom ? (e) => { e.stopPropagation(); next() } : undefined}
          draggable={false}
        />
      </div>

      {/* Thumbnails */}
      {total > 1 && (
        <div className="lb-thumbs" ref={thumbRef}>
          {photos.map((p, i) => (
            <img
              key={p.id}
              src={thumbUrl(p.thumb) || fileUrl(p.filename)}
              alt=""
              className={`lb-thumb ${i === idx ? 'active' : ''}`}
              onClick={() => go(i)}
              draggable={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
