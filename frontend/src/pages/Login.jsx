import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { Sun, Moon, Fingerprint, CheckCircle2 } from 'lucide-react'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const MIN_SCAN_MS = 1100 // keep the scan animation from flashing by too fast on a quick LAN response

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate  = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [scanState, setScanState] = useState('idle') // idle | scanning | success | error
  const busy = scanState !== 'idle'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setScanState('scanning')
    try {
      await Promise.all([login(email, password), wait(MIN_SCAN_MS)])
      setScanState('success')
      await wait(500)
      navigate('/')
    } catch (err) {
      setScanState('error')
      await wait(650)
      setScanState('idle')
      setError(err.message)
    }
  }

  return (
    <div style={styles.page}>
      <div className="login-toggles" style={styles.toggle}>
        <LanguageSwitcher />
        <button
          type="button"
          className="pill-group theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
        >
          <span className={`pill ${theme === 'dark' ? 'active' : ''}`}><Moon size={13} /></span>
          <span className={`pill ${theme === 'light' ? 'active' : ''}`}><Sun size={13} /></span>
        </button>
      </div>

      <div className="card fade-in" style={styles.card}>
        {/* Logo / Brand */}
        <div style={styles.brand}>
          <div style={styles.logo}>AC</div>
          <div>
            <div style={styles.brandName}>{t('login.brandName')}</div>
            <div style={styles.brandSub}>{t('login.brandSub')}</div>
          </div>
        </div>

        <div style={styles.formShell}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>{t('login.email')}</label>
              <input
                className="input"
                type="email" value={email} required autoFocus disabled={busy}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>{t('login.password')}</label>
              <input
                className="input"
                type="password" value={password} required disabled={busy}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button className="btn btn-primary" style={styles.submit} disabled={busy} type="submit">
              {t('login.signIn')}
            </button>
          </form>

          {busy && (
            <div className={`scan-overlay ${scanState}`}>
              <div className="scan-badge">
                <div className="scan-ring" />
                <div className="scan-icon-wrap">
                  <Fingerprint size={40} className="scan-fingerprint" />
                  <div className="scan-line" />
                  {scanState === 'success' && <CheckCircle2 size={18} className="scan-check" />}
                </div>
              </div>
              <div className="scan-label">
                {scanState === 'scanning' && t('login.scanning')}
                {scanState === 'success' && t('login.scanSuccess')}
                {scanState === 'error' && t('login.scanFailed')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse at 60% 20%, var(--login-glow) 0%, var(--bg) 70%)',
    padding: 24, position: 'relative',
  },
  toggle: { position: 'absolute', top: 24, right: 24, display: 'flex', gap: 8 },
  card: {
    width: '100%', maxWidth: 420, padding: '40px 36px',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 },
  logo: {
    width: 44, height: 44, borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--on-accent)',
    flexShrink: 0,
  },
  brandName: { fontWeight: 600, fontSize: 16, letterSpacing: '-0.3px' },
  brandSub:  { fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  formShell: { position: 'relative' },
  form:  { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--muted)', letterSpacing: '0.3px' },
  submit: { padding: '13px', fontSize: 15, marginTop: 6, width: '100%' },
  error: {
    background: 'var(--danger-soft)', border: '1px solid var(--danger)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13,
  },
}
