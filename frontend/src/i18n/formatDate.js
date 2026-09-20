const LOCALE_MAP = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ' }

export const localeFor = (lng) => LOCALE_MAP[lng] || 'en-GB'

export const formatDate = (value, lng, options) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(localeFor(lng), options)
}

export const formatTime = (value, lng, options = { hour: '2-digit', minute: '2-digit' }) => {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString(localeFor(lng), options)
}

export const formatDateTime = (value, lng) => {
  if (!value) return '-'
  return new Date(value).toLocaleString(localeFor(lng))
}

export const formatHoursDuration = (value) => {
  const totalMinutes = Math.round(Number(value || 0) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
