import { settingAPI } from '../api'

const THEME_KEYS = [
  'primary_color',
  'primary_hover',
  'sidebar_bg',
  'sidebar_text',
  'sidebar_active',
  'sidebar_active_bg',
  'body_bg',
  'card_bg',
  'text_main',
  'text_muted',
]

const DEFAULTS = {
  primary_color: '#f59e0b',
  primary_hover: '#d97706',
  sidebar_bg: '#0f172a',
  sidebar_text: '#ffffff',
  sidebar_active: '#fbbf24',
  sidebar_active_bg: 'rgba(251, 191, 36, 0.15)',
  body_bg: '#f1f5f9',
  card_bg: '#ffffff',
  text_main: '#1e293b',
  text_muted: '#64748b',
}

const CSS_MAP = {
  primary_color: '--primary-color',
  primary_hover: '--primary-hover',
  sidebar_bg: '--sidebar-bg',
  sidebar_text: '--sidebar-text',
  sidebar_active: '--sidebar-active',
  sidebar_active_bg: '--sidebar-active-bg',
  body_bg: '--body-bg',
  card_bg: '--card-bg',
  text_main: '--text-main',
  text_muted: '--text-muted',
}

export function applyTheme(settings) {
  const root = document.documentElement
  THEME_KEYS.forEach((key) => {
    const value = settings?.[key] || DEFAULTS[key]
    const cssVar = CSS_MAP[key]
    if (cssVar && value) {
      root.style.setProperty(cssVar, value)
    }
  })
}

export function loadAndApplyTheme() {
  // Try localStorage first
  const cached = localStorage.getItem('store_theme_settings')
  if (cached) {
    try {
      applyTheme(JSON.parse(cached))
    } catch {}
  }

  // Fetch from API
  settingAPI.list().then((r) => {
    const settings = {}
    r.data.forEach((s) => { settings[s.key] = s.value || '' })
    localStorage.setItem('store_theme_settings', JSON.stringify(settings))
    applyTheme(settings)
  }).catch(() => {})
}

export function saveThemeSettingsToCache(settings) {
  localStorage.setItem('store_theme_settings', JSON.stringify(settings))
  applyTheme(settings)
}
