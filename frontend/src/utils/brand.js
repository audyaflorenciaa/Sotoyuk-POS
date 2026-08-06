import { settingAPI } from '../api'
import axios from 'axios'

const STORAGE_KEY = 'store_brand_settings'

export function applyBrandSettings(settings) {
  if (!settings) return

  // Update page title
  const storeName = settings.store_name
  if (storeName) {
    document.title = `${storeName} POS`
  }

  // Update favicon
  const logo = settings.store_logo
  if (logo) {
    const logoUrl = logo.startsWith('/') ? logo : `/${logo}`
    let link = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = logoUrl
    link.type = logo.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
  }
}

export function loadAndApplyBrand() {
  // Try from localStorage first for instant render
  const cached = localStorage.getItem(STORAGE_KEY)
  if (cached) {
    try {
      applyBrandSettings(JSON.parse(cached))
    } catch {}
  }

  // Fetch from API (authenticated or public)
  const load = () => {
    settingAPI.list().then((r) => {
      const settings = {}
      r.data.forEach((s) => { settings[s.key] = s.value || '' })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      applyBrandSettings(settings)
    }).catch(() => {
      // Fallback to public endpoint
      axios.get('/api/public/store-info').then((r) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(r.data))
        applyBrandSettings(r.data)
      }).catch(() => {})
    })
  }

  load()
}

export function saveBrandSettingsToCache(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  applyBrandSettings(settings)
}
