import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Trash2, Building2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCompany } from '../../context/CompanyContext'

export default function SettingsGeneral() {
  const { t } = useTranslation()
  const { user, authFetch } = useAuth()
  const { companyName, logoUrl, refresh } = useCompany()
  const isAdmin = user?.role === 'admin'

  const [name, setName] = useState(companyName)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { setName(companyName) }, [companyName])

  const saveName = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const res = await authFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: name }),
    })
    setSaving(false)
    if (!res?.ok) { setMessage(t('reports.couldNotSaveSettings')); return }
    setMessage(t('reports.savedMessage'))
    refresh()
  }

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('logo', file)
    const res = await authFetch('/api/settings/logo', { method: 'POST', body: form })
    setUploading(false)
    if (res?.ok) refresh()
  }

  const removeLogo = async () => {
    await authFetch('/api/settings/logo', { method: 'DELETE' })
    refresh()
  }

  return (
    <div style={styles.stack}>
      <div className="card" style={styles.card}>
        <h3 style={styles.title}>{t('settings.companyInfoSection')}</h3>

        <form onSubmit={saveName} style={styles.form}>
          <label style={styles.label}>{t('settings.companyName')}</label>
          <input
            className="input" type="text" style={styles.nameInput}
            placeholder={t('settings.companyNamePlaceholder')}
            value={name} disabled={!isAdmin}
            onChange={e => setName(e.target.value)}
          />
          {isAdmin ? (
            <div style={styles.saveRow}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('reports.savingEllipsis') : t('settings.saveCompanyInfo')}
              </button>
              {message && <span style={styles.message}>{message}</span>}
            </div>
          ) : (
            <p style={styles.notice}>{t('settings.adminOnlyNotice')}</p>
          )}
        </form>
      </div>

      <div className="card" style={styles.card}>
        <h3 style={styles.title}>{t('settings.logo')}</h3>
        <p style={styles.hint}>{t('settings.logoHint')}</p>

        <div style={styles.logoRow}>
          <div style={styles.logoPreview}>
            {logoUrl ? <img src={logoUrl} alt="" style={styles.logoImg} /> : <Building2 size={22} color="var(--muted)" />}
          </div>

          {isAdmin && (
            <div style={styles.logoActions}>
              <label className="btn btn-ghost" style={styles.uploadLabel}>
                <Upload size={14} /> {uploading ? t('reports.savingEllipsis') : t('settings.uploadLogo')}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={uploadLogo} />
              </label>
              {logoUrl && (
                <button type="button" className="btn btn-danger" onClick={removeLogo}>
                  <Trash2 size={14} /> {t('settings.removeLogo')}
                </button>
              )}
            </div>
          )}
          {!logoUrl && !isAdmin && <span style={styles.hint}>{t('settings.noLogo')}</span>}
        </div>
      </div>
    </div>
  )
}

const styles = {
  stack: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 },
  card: { padding: '20px 22px' },
  title: { fontSize: 14, fontWeight: 600, marginBottom: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 12, color: 'var(--muted)' },
  nameInput: { width: '100%' },
  saveRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 },
  message: { fontSize: 12, color: 'var(--muted)' },
  notice: { fontSize: 12, color: 'var(--muted)', marginTop: 4 },
  hint: { fontSize: 12, color: 'var(--muted)', marginBottom: 14 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  logoPreview: {
    width: 56, height: 56, borderRadius: 10, flexShrink: 0,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  logoActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  uploadLabel: { cursor: 'pointer' },
}
