import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import EmptyState from '../../components/EmptyState'
import { SkeletonBlock } from '../../components/Skeleton'
import { formatDate } from '../../i18n/formatDate'

const today = () => new Date().toISOString().slice(0, 10)

export default function SettingsShift() {
  const { t, i18n } = useTranslation()
  const { authFetch } = useAuth()

  const [settingsForm, setSettingsForm] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [holidays, setHolidays] = useState([])
  const [holidaysYear, setHolidaysYear] = useState(new Date().getFullYear())
  const [holidayForm, setHolidayForm] = useState({ date: today(), name: '' })
  const [settingsMessage, setSettingsMessage] = useState('')

  const loadSettings = () => {
    authFetch('/api/settings')
      .then(r => r?.json())
      .then(d => {
        const s = d?.data
        if (s) setSettingsForm({
          shiftStart: s.shift_start?.slice(0, 5) || '08:00',
          shiftEnd: s.shift_end?.slice(0, 5) || '17:00',
          graceMinutes: s.grace_minutes ?? 10,
          overtimeDailyThresholdHours: s.overtime_daily_threshold_hours ?? 8,
          overtimeMultiplier: s.overtime_multiplier ?? 1.5,
        })
      })
  }

  const loadHolidays = (year = holidaysYear) => {
    authFetch(`/api/holidays?year=${year}`)
      .then(r => r?.json())
      .then(d => setHolidays(Array.isArray(d?.data) ? d.data : []))
  }

  useEffect(() => {
    loadSettings()
    loadHolidays()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadHolidays(holidaysYear) }, [holidaysYear])

  const saveSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsMessage('')
    const res = await authFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsForm),
    })
    setSavingSettings(false)
    if (!res?.ok) {
      setSettingsMessage(t('reports.couldNotSaveSettings'))
      return
    }
    setSettingsMessage(t('reports.savedMessage'))
  }

  const addHoliday = async (e) => {
    e.preventDefault()
    if (!holidayForm.name.trim()) return
    const res = await authFetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holidayForm),
    })
    if (res?.ok) {
      setHolidayForm({ date: today(), name: '' })
      loadHolidays()
    }
  }

  const removeHoliday = async (id) => {
    await authFetch(`/api/holidays/${id}`, { method: 'DELETE' })
    loadHolidays()
  }

  if (!settingsForm) return <SkeletonBlock height={180} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <section className="card" style={styles.card}>
        <h3 style={styles.sectionTitle}>{t('reports.shiftOvertimeSection')}</h3>
        <form onSubmit={saveSettings} style={styles.settingsGrid}>
          <SettingField label={t('reports.shiftStart')}>
            <input className="input" type="time" value={settingsForm.shiftStart}
              onChange={e => setSettingsForm(f => ({ ...f, shiftStart: e.target.value }))} />
          </SettingField>
          <SettingField label={t('reports.shiftEnd')}>
            <input className="input" type="time" value={settingsForm.shiftEnd}
              onChange={e => setSettingsForm(f => ({ ...f, shiftEnd: e.target.value }))} />
          </SettingField>
          <SettingField label={t('reports.gracePeriod')}>
            <input className="input" type="number" min={0} value={settingsForm.graceMinutes}
              onChange={e => setSettingsForm(f => ({ ...f, graceMinutes: Number(e.target.value || 0) }))} />
          </SettingField>
          <SettingField label={t('reports.overtimeThreshold')}>
            <input className="input" type="number" min={0} step="0.5" value={settingsForm.overtimeDailyThresholdHours}
              onChange={e => setSettingsForm(f => ({ ...f, overtimeDailyThresholdHours: Number(e.target.value || 0) }))} />
          </SettingField>
          <SettingField label={t('reports.overtimeMultiplier')}>
            <input className="input" type="number" min={1} step="0.1" value={settingsForm.overtimeMultiplier}
              onChange={e => setSettingsForm(f => ({ ...f, overtimeMultiplier: Number(e.target.value || 0) }))} />
          </SettingField>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={savingSettings}>
              {savingSettings ? t('reports.savingEllipsis') : t('reports.saveShiftSettings')}
            </button>
            {settingsMessage && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{settingsMessage}</span>}
          </div>
        </form>
      </section>

      <section className="card" style={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={styles.sectionTitle}>{t('reports.publicHolidays')}</h3>
          <input className="input" style={{ width: 100 }} type="number" value={holidaysYear}
            onChange={e => setHolidaysYear(Number(e.target.value || new Date().getFullYear()))} />
        </div>
        <form onSubmit={addHoliday} style={styles.holidayForm}>
          <input className="input" type="date" value={holidayForm.date}
            onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))} />
          <input className="input" style={{ flex: 1 }} type="text" placeholder={t('reports.holidayNamePlaceholder')}
            value={holidayForm.name} onChange={e => setHolidayForm(f => ({ ...f, name: e.target.value }))} />
          <button type="submit" className="btn btn-ghost"><Plus size={14} /> {t('reports.add')}</button>
        </form>
        <div style={styles.holidayList}>
          {holidays.length === 0 ? <EmptyState icon={CalendarOff}>{t('reports.noHolidaysForYear', { year: holidaysYear })}</EmptyState> : holidays.map(h => (
            <div key={h.id} style={styles.holidayRow}>
              <span><b style={{ fontFamily: 'var(--mono)' }}>{formatDate(h.date, i18n.language)}</b> — {h.name}</span>
              <button className="icon-btn danger" onClick={() => removeHoliday(h.id)} title={t('reports.removeHoliday')}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SettingField({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      {children}
    </label>
  )
}

const styles = {
  card: { padding: '20px 22px' },
  sectionTitle: { fontSize: 14, fontWeight: 600, marginBottom: 14 },
  settingsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '14px 16px', alignItems: 'end' },
  holidayForm: { display: 'flex', gap: 8, marginBottom: 14 },
  holidayList: { display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 320, overflowY: 'auto' },
  holidayRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 2px', borderBottom: '1px solid var(--border)', fontSize: 13 },
}
