import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'
import ar from './locales/ar.json'

const RTL_LANGUAGES = ['ar']

const getInitialLanguage = () => {
  try {
    const saved = localStorage.getItem('language')
    if (saved && ['en', 'fr', 'ar'].includes(saved)) return saved
  } catch {}
  return 'en'
}

const applyDocumentDirection = (lng) => {
  document.documentElement.dir = RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr'
  document.documentElement.lang = lng
}

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar } },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

applyDocumentDirection(i18n.language)

i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem('language', lng) } catch {}
  applyDocumentDirection(lng)
})

export default i18n
