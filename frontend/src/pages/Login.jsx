import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { Sun, Moon } from 'lucide-react'

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate  = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>{t('login.email')}</label>
            <input
              className="input"
              type="email" value={email} required autoFocus
              onChange={e => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{t('login.password')}</label>
            <input
              className="input"
              type="password" value={password} required
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button className="btn btn-primary" style={{...styles.submit, opacity: loading ? 0.7 : 1}} disabled={loading} type="submit">
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
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
  form:  { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--muted)', letterSpacing: '0.3px' },
  submit: { padding: '13px', fontSize: 15, marginTop: 6, width: '100%' },
  error: {
    background: 'var(--danger-soft)', border: '1px solid var(--danger)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13,
  },
}
