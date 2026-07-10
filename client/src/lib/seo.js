// Lightweight, dependency-free document <head> updates — this SPA has no
// server-side rendering, so these only help the browser tab/history and
// client-side link-preview tools, not crawlers, but cost nothing to keep.

function setMetaTag(selector, attr, value, createAttrs) {
  let el = document.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    Object.entries(createAttrs).forEach(([k, v]) => el.setAttribute(k, v))
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

export function setPageMeta({ title, description }) {
  if (title) document.title = title
  if (description) {
    setMetaTag('meta[name="description"]', 'content', description, { name: 'description' })
    setMetaTag('meta[property="og:description"]', 'content', description, { property: 'og:description' })
  }
  if (title) setMetaTag('meta[property="og:title"]', 'content', title, { property: 'og:title' })
}
