import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { Sun, Moon, Copy, Check, MessageCircle } from 'lucide-react'

const VENDOR_WHATSAPP = '213553579430'

export default function ActivateLicense({ onActivated }) {
  const { t } = useTranslation()
  const { authFetch, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [machineId, setMachineId] = useState('')
  const [blob, setBlob] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    authFetch('/api/license/fingerprint')
      .then(res => res?.ok && res.json())
      .then(data => data?.data && setMachineId(data.data.machineId))
      .catch(() => {})
  }, [authFetch])

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(machineId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable, ignore */ }
  }

  const whatsappHref = `https://wa.me/${VENDOR_WHATSAPP}?text=${encodeURIComponent(
    `Hi! I'd like to activate Attendance Checkpoint. Machine ID: ${machineId}`
  )}`

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setSubmitting(true)
    try {
      const res = await authFetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseBlob: blob.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res?.ok) throw new Error(data?.error?.message || t('license.invalidLicense'))
      onActivated?.()
    } catch (err) {
      setError(err.message || t('license.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.toggle}>
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
        <div style={styles.title}>{t('license.title')}</div>
        <div style={styles.intro}>{t('license.notActivatedIntro')}</div>

        <div style={styles.field}>
          <label style={styles.label}>{t('license.machineId')}</label>
          <div style={styles.idRow}>
            <code style={styles.idValue}>{machineId || '…'}</code>
            <button type="button" className="btn" style={styles.iconBtn} onClick={copyId} title={t('license.copy')}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <a
              href={whatsappHref} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary" style={styles.iconBtn} title={t('license.shareWhatsApp')}
            >
              <MessageCircle size={15} />
            </a>
          </div>
        </div>

        {user?.role === 'admin' ? (
          <form onSubmit={submit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>{t('license.pasteLabel')}</label>
              <textarea
                className="input" rows={4} required
                value={blob} onChange={e => setBlob(e.target.value)}
                placeholder={t('license.pastePlaceholder')}
                style={styles.textarea}
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button className="btn btn-primary" style={styles.submit} disabled={submitting} type="submit">
              {submitting ? t('license.activating') : t('license.activate')}
            </button>
          </form>
        ) : (
          <div style={styles.intro}>{t('license.nonAdminMessage')}</div>
        )}
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
  card: { width: '100%', maxWidth: 460, padding: '40px 36px' },
  title: { fontWeight: 600, fontSize: 18, letterSpacing: '-0.3px', marginBottom: 10 },
  intro: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 22 },
  form:  { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--muted)', letterSpacing: '0.3px' },
  idRow: { display: 'flex', alignItems: 'center', gap: 8 },
  idValue: {
    flex: 1, padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)',
    fontFamily: 'var(--mono)', fontSize: 13, overflowWrap: 'anywhere',
  },
  iconBtn: { padding: '10px 12px', flexShrink: 0 },
  textarea: { fontFamily: 'var(--mono)', fontSize: 12, resize: 'vertical' },
  submit: { padding: '13px', fontSize: 15, width: '100%' },
  error: {
    background: 'var(--danger-soft)', border: '1px solid var(--danger)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13,
  },
}
