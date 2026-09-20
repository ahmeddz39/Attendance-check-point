import { useEffect, useState } from 'react'
import { Search, X, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { SkeletonBlock } from '../components/Skeleton'
import MonthPicker from '../components/MonthPicker'
import useAutoRefresh from '../hooks/useAutoRefresh'

const money = (value) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} DZD`
const hours = (value) => Number(value || 0).toFixed(2)
const currentMonth = () => new Date().toISOString().slice(0, 7)

export default function Salary() {
  const { t } = useTranslation()
  const { authFetch } = useAuth()
  const [summary, setSummary] = useState({ rows: [], totals: {}, rules: {} })
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    const params = new URLSearchParams({ month })
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim())
    if (deviceId) params.set('deviceId', deviceId)

    authFetch(`/api/attendance/salary?${params.toString()}`)
      .then(r => r?.json())
      .then(d => setSummary(d?.data || { rows: [], totals: {}, rules: {} }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    authFetch('/api/devices')
      .then(r => r?.json())
      .then(d => setDevices(Array.isArray(d?.data) ? d.data : []))
  }, [authFetch])

  useEffect(() => { load() }, [authFetch, month, appliedSearch, deviceId])
  useAutoRefresh(() => load(true), 60000)

  const submitSearch = (e) => {
    e.preventDefault()
    setAppliedSearch(search)
  }

  const clearSearch = () => {
    setSearch('')
    setAppliedSearch('')
  }

  const rows = summary.rows || []

  return (
    <div style={styles.page} className="fade-in">
      <PageHeader title={t('salary.title')} subtitle={t('salary.subtitle')} />
      <div style={styles.toolbar}>
        <MonthPicker value={month} onChange={setMonth} />
        {devices.length > 0 && (
          <select className="select" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
            <option value="">{t('common.allDevices')}</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <form style={styles.search} onSubmit={submitSearch}>
          <Search size={15} color="var(--muted)" />
          <input
            style={styles.searchInput}
            placeholder={t('salary.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {appliedSearch && (
            <button className="icon-btn" style={styles.clearBtn} type="button" onClick={clearSearch} title={t('salary.clearSearch')}><X size={14} /></button>
          )}
          <button className="btn btn-ghost" style={styles.searchBtn} type="submit">{t('salary.search')}</button>
        </form>
      </div>
      <div className="stat-grid">
        <Summary label={t('salary.employees')} value={summary.totals?.employees || 0} />
        <Summary label={t('salary.presentDays')} value={summary.totals?.presentDays || 0} />
        <Summary label={t('salary.absentDays')} value={summary.totals?.absentDays || 0} />
        <Summary label={t('salary.incompleteDays')} value={summary.totals?.incompleteDays || 0} />
        <Summary label={t('salary.lateDays')} value={summary.totals?.lateDays || 0} />
        <Summary label={t('salary.workedHours')} value={hours(summary.totals?.workedHours)} />
        <Summary label={t('salary.overtimeHours')} value={hours(summary.totals?.overtimeHours)} />
        <Summary label={t('salary.overtimePay')} value={money(summary.totals?.overtimePay)} />
        <Summary label={t('salary.estimatedPay')} value={money(summary.totals?.estimatedSalary)} />
      </div>
      <div style={styles.rules}>
        <span>{t('salary.workWeekLabel', { value: t('salary.workWeekMonFri') })}</span>
        <span>{t('salary.presentRule')}</span>
        <span>{t('salary.absentRule')}</span>
        <span>{t('salary.holidayRule')}</span>
      </div>
      <div className="card">
        {loading ? <div style={{ padding: 20 }}><SkeletonBlock height={200} /></div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr>
                <th>{t('salary.colEmployee')}</th>
                <th>{t('salary.colDepartment')}</th>
                <th className="num">{t('salary.colScheduled')}</th>
                <th className="num">{t('salary.colPresent')}</th>
                <th className="num">{t('salary.colAbsent')}</th>
                <th className="num">{t('salary.colIncomplete')}</th>
                <th className="num">{t('salary.colLate')}</th>
                <th className="num">{t('salary.colRegularHrs')}</th>
                <th className="num">{t('salary.colOtHrs')}</th>
                <th className="num">{t('salary.colOtPay')}</th>
                <th>{t('salary.colSalaryRule')}</th>
                <th className="num">{t('salary.colEstimatedPay')}</th>
              </tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td><b>{row.first_name} {row.last_name}</b><div style={styles.muted}>{row.employee_code}</div></td>
                    <td>{row.department || '-'}</td>
                    <td className="num">{row.scheduled_days}</td>
                    <td className="num">{row.present_days}</td>
                    <td className="num" style={{color:Number(row.absent_days) > 0 ? 'var(--warn)' : 'var(--muted)'}}>{row.absent_days}</td>
                    <td className="num" style={{color:Number(row.incomplete_days) > 0 ? 'var(--warn)' : 'var(--muted)'}}>{row.incomplete_days}</td>
                    <td className="num">{Number(row.late_days) > 0 ? <Badge tone="warn">{row.late_days}</Badge> : <span style={{color:'var(--muted)'}}>0</span>}</td>
                    <td className="num">{hours(row.regular_hours)}</td>
                    <td className="num" style={{color: Number(row.overtime_hours) > 0 ? 'var(--accent2)' : 'var(--muted)'}}>{hours(row.overtime_hours)}</td>
                    <td className="num" style={{color: Number(row.overtime_pay) > 0 ? 'var(--accent2)' : 'var(--muted)'}}>{money(row.overtime_pay)}</td>
                    <td>{row.salary_type === 'monthly' ? `${money(row.monthly_salary)} ${t('common.perMonth')}` : `${money(row.hourly_rate)} ${t('common.perHour')}`}</td>
                    <td className="num" style={{color:'var(--accent)'}}>{money(row.estimated_salary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <EmptyState icon={WalletCards}>{t('salary.noData')}</EmptyState>}
          </div>
        )}
      </div>
    </div>
  )
}

function Summary({ label, value }) {
  return (
    <div className="stat-card" style={styles.summary}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  )
}

const styles = {
  page:{display:'flex',flexDirection:'column',gap:20},
  toolbar:{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'},
  search:{display:'flex',alignItems:'center',gap:8,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:9,padding:'0 8px',height:38,minWidth:280},
  searchInput:{flex:1,background:'transparent',border:'none',outline:'none',color:'var(--text)',fontSize:13},
  searchBtn:{height:30,padding:'0 12px'},
  clearBtn:{width:24,height:24,border:'none'},
  summary:{padding:'14px 16px'},
  summaryLabel:{fontSize:11,color:'var(--muted)',textTransform:'uppercase',marginBottom:6},
  summaryValue:{fontSize:18,fontWeight:700,fontFamily:'var(--mono)',color:'var(--text)'},
  rules:{display:'flex',gap:10,flexWrap:'wrap',color:'var(--muted)',fontSize:12},
  muted:{color:'var(--muted)',fontSize:12},
}
