import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default function SettingsLanguage() {
  const { t } = useTranslation()

  return (
    <div className="card" style={styles.card}>
      <h3 style={styles.title}>{t('settings.languageTitle')}</h3>
      <p style={styles.subtitle}>{t('settings.languageSubtitle')}</p>

      <LanguageSwitcher />
    </div>
  )
}

const styles = {
  card: { padding: '20px 22px', maxWidth: 420 },
  title: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'var(--muted)', marginBottom: 18 },
}
