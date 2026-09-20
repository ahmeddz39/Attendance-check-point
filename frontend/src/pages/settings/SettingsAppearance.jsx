import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

export default function SettingsAppearance() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <div className="card" style={styles.card}>
      <h3 style={styles.title}>{t('settings.appearanceTitle')}</h3>
      <p style={styles.subtitle}>{t('settings.appearanceSubtitle')}</p>

      <div className="pill-group theme-toggle" style={styles.pillGroup}>
        <button type="button" className={`pill ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
          <Moon size={14} /> {t('theme.dark')}
        </button>
        <button type="button" className={`pill ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
          <Sun size={14} /> {t('theme.light')}
        </button>
      </div>
    </div>
  )
}

const styles = {
  card: { padding: '20px 22px', maxWidth: 420 },
  title: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'var(--muted)', marginBottom: 18 },
  pillGroup: { display: 'inline-flex' },
}
