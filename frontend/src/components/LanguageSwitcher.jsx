import { useTranslation } from 'react-i18next'
import SegmentedControl from './SegmentedControl'

const LANGUAGES = [
  { value: 'en', label: 'EN' },
  { value: 'fr', label: 'FR' },
  { value: 'ar', label: 'AR' },
]

export default function LanguageSwitcher({ className }) {
  const { i18n } = useTranslation()
  return (
    <SegmentedControl
      className={className}
      options={LANGUAGES}
      value={i18n.language}
      onChange={(lng) => i18n.changeLanguage(lng)}
    />
  )
}
