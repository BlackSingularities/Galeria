const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') // e.g. '/galeria' or ''

export const API   = `${BASE}/api`
// `token` is only required for photos in password-protected albums — public
// portfolio photos and public albums ignore it. Passing it unconditionally is
// harmless, so callers with a token in scope can just always pass it through.
export const fileUrl  = (f, token) => f ? `${BASE}/uploads/${f}${token ? `?t=${encodeURIComponent(token)}` : ''}` : ''
export const thumbUrl = (f, token) => f ? `${BASE}/thumbs/${f}${token ? `?t=${encodeURIComponent(token)}` : ''}`  : ''

const getToken = () => localStorage.getItem('admin_token')

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  const t = token || getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error || 'Error'), { ...err, status: res.status })
  }
  return res.json()
}

// ── Public ────────────────────────────────────────────────────────────────────
export const getPortfolio  = () => req('GET', '/portfolio')
export const verifyAlbum   = (slug, password) => req('POST', `/albums/${slug}/verify`, { password })
export const getAlbum      = (slug, token)    => req('GET',  `/albums/${slug}`, null, token)
export const createAlbumShare = (slug, expiresIn, token) => req('POST', `/albums/${slug}/share`, { expiresIn }, token)

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminLogin       = (password) => req('POST', '/admin/login', { password })
export const adminGetStats    = () => req('GET',  '/admin/stats')
export const adminGetAlbums   = () => req('GET',  '/admin/albums')
export const adminCreateAlbum = (data) => req('POST', '/admin/albums', data)
export const adminUpdateAlbum = (id, data) => req('PUT', `/admin/albums/${id}`, data)
export const adminSetAlbumCover = (id, photoId) => req('PUT', `/admin/albums/${id}/cover`, { photoId })
export const adminDeleteAlbum = (id) => req('DELETE', `/admin/albums/${id}`)
export const adminGetPhotos   = () => req('GET',  '/admin/photos')
export const adminUpdatePhoto = (id, data) => req('PUT', `/admin/photos/${id}`, data)
export const adminReorderPhotos = (ids) => req('PUT', '/admin/photos/reorder', { ids })
export const adminDeletePhoto = (id) => req('DELETE', `/admin/photos/${id}`)

const UPLOAD_BATCH_SIZE = 1

function uploadBatch(albumId, files, quality, onProgress) {
  const token = getToken()
  const fd = new FormData()
  for (const f of files) fd.append('photos', f)
  fd.append('quality', quality)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = albumId
      ? `${API}/admin/albums/${albumId}/upload`
      : `${API}/admin/portfolio/upload`
    xhr.open('POST', url)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    if (onProgress) xhr.upload.onprogress = (e) => onProgress(e.loaded / e.total)
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(new Error(xhr.status === 413 ? 'Plik jest większy niż limit uploadu serwera.' : `Upload failed (${xhr.status})`))
      }
      try { const d = JSON.parse(xhr.responseText); resolve(d) } catch { reject(new Error('Upload failed')) }
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(fd)
  })
}

export async function adminUpload(albumId, files, onProgress, onFileStart, quality = 'optimized') {
  const list = Array.from(files)
  const totalBytes = list.reduce((sum, file) => sum + file.size, 0)
  let uploadedBeforeBatch = 0
  let uploaded = 0
  const results = []

  for (let i = 0; i < list.length; i += UPLOAD_BATCH_SIZE) {
    const batch = list.slice(i, i + UPLOAD_BATCH_SIZE)
    onFileStart?.(batch[0], i, list.length)
    const batchBytes = batch.reduce((sum, file) => sum + file.size, 0)
    const res = await uploadBatch(albumId, batch, quality, (batchProgress) => {
      if (onProgress && totalBytes > 0) {
        onProgress((uploadedBeforeBatch + batchBytes * batchProgress) / totalBytes)
      }
    })
    uploadedBeforeBatch += batchBytes
    uploaded += res.uploaded || 0
    results.push(...(res.results || []))
  }

  if (onProgress) onProgress(1)
  return { uploaded, results }
}
