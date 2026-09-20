import { useEffect, useMemo, useState } from 'react'
import { Search, Clock, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import SegmentedControl from '../components/SegmentedControl'
import DatePicker from '../components/DatePicker'
import MonthPicker from '../components/MonthPicker'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { SkeletonBlock } from '../components/Skeleton'
import { formatDate, formatTime, formatDateTime, formatHoursDuration } from '../i18n/formatDate'
import { tableHtml, downloadBlob, exportPdf, toCsv } from '../utils/exportTable'
import useAutoRefresh from '../hooks/useAutoRefresh'

const today = () => new Date().toISOString().slice(0, 10)
const month = () => new Date().toISOString().slice(0, 7)

const STATUS_TONE = { present: 'accent', late: 'accent2', early: 'warn', absent: 'danger', incomplete: 'warn', unmatched: 'muted' }

const toRange = (mode, value) => {
  if (mode === 'month') {
    const [year, monthIndex] = value.split('-').map(Number)
    const start = new Date(year, monthIndex - 1, 1)
    const end = new Date(year, monthIndex, 1)
    return { from: start.toISOString(), to: end.toISOString() }
  }

  const start = new Date(`${value}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

export default function AttendanceLogs() {
  const { t, i18n } = useTranslation()
  const { authFetch } = useAuth()
  const { companyName, logoUrl } = useCompany()
  const [rows, setRows] = useState([])
  const [mode, setMode] = useState('day')
  const [dateValue, setDateValue] = useState(today())
  const [monthValue, setMonthValue] = useState(month())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')

  const MODES = [
    { value: 'day',   label: t('attendance.day') },
    { value: 'month', label: t('attendance.month') },
  ]

  const range = useMemo(
    () => toRange(mode, mode === 'month' ? monthValue : dateValue),
    [mode, dateValue, monthValue]
  )

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    const params = new URLSearchParams({ from: range.from, to: range.to })
    if (search.trim()) params.set('search', search.trim())
    if (deviceId) params.set('deviceId', deviceId)

    authFetch(`/api/attendance/daily?${params.toString()}`)
      .then(r => r?.json())
      .then(d => setRows(Array.isArray(d?.data) ? d.data : d?.data?.rows || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    authFetch('/api/devices')
      .then(r => r?.json())
      .then(d => setDevices(Array.isArray(d?.data) ? d.data : []))
  }, [authFetch])

  useEffect(() => { load() }, [authFetch, range.from, range.to, deviceId])
  useAutoRefresh(() => load(true), 60000)

  const submitSearch = (e) => {
    e.preventDefault()
    load()
  }

  const exportRows = () => rows.map(row => [
    formatDate(row.work_day, i18n.language),
    row.first_name ? `${row.first_name} ${row.last_name || ''}` : t('attendance.unmatchedEmployee'),
    row.employee_code || row.device_user_id || '-',
    row.department || '-',
    t(`common.status.${row.attendance_status}`, row.attendance_status || '-'),
    formatTime(row.check_in_at, i18n.language),
    formatTime(row.check_out_at, i18n.language),
    formatHoursDuration(row.worked_hours),
    row.punch_count,
    Array.isArray(row.devices) && row.devices.length ? row.devices.join(', ') : '-',
  ])

  const exportHeaders = [
    t('attendance.colDate'), t('attendance.colEmployee'), t('attendance.colCode'), t('attendance.colDepartment'),
    t('attendance.colStatus'),
    { label: t('attendance.colCheckIn'), kind: 'checkin' },
    { label: t('attendance.colCheckOut'), kind: 'checkout' },
    { label: t('attendance.colHours'), kind: 'hours' },
    t('attendance.colPunches'), t('attendance.colDevice'),
  ]

  const exportTitle = mode === 'month'
    ? t('attendance.exportTitleMonth', { month: monthValue })
    : t('attendance.exportTitleDay', { date: dateValue })
  const exportFilename = `attendance-${mode === 'month' ? monthValue : dateValue}`

  const handleExportPdf = () => {
    const branding = {
      companyName,
      logoUrl: logoUrl ? `${window.location.origin}${logoUrl}` : null,
      dir: i18n.dir(),
      generatedLabel: t('reports.exportGeneratedOn', { date: formatDateTime(new Date(), i18n.language) }),
      recordsLabel: t('reports.exportRecordCount', { count: rows.length }),
    }
    exportPdf(tableHtml(exportTitle, exportHeaders, exportRows(), branding))
  }

  const handleExportExcel = () => {
    const branding = {
      companyName,
      dir: i18n.dir(),
      generatedLabel: t('reports.exportGeneratedOn', { date: formatDateTime(new Date(), i18n.language) }),
      recordsLabel: t('reports.exportRecordCount', { count: rows.length }),
    }
    downloadBlob(
      tableHtml(exportTitle, exportHeaders, exportRows(), branding),
      `${exportFilename}.xls`,
      'application/vnd.ms-excel'
    )
  }

  const handleExportCsv = () => {
    downloadBlob(toCsv(exportHeaders, exportRows()), `${exportFilename}.csv`, 'text/csv;charset=utf-8;')
  }

  return (
    <div style={styles.page} className="fade-in">
      <PageHeader title={t('attendance.title')} subtitle={t('attendance.subtitle')} />

      <div style={styles.filters}>
        <SegmentedControl options={MODES} value={mode} onChange={setMode} />

        {mode === 'day' ? (
          <DatePicker value={dateValue} onChange={setDateValue} />
        ) : (
          <MonthPicker value={monthValue} onChange={setMonthValue} />
        )}

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
            placeholder={t('attendance.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-ghost" style={styles.searchBtn} type="submit">{t('attendance.search')}</button>
        </form>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn-ghost" onClick={handleExportPdf} type="button" disabled={rows.length === 0}><Download size={14} /> {t('reports.pdf')}</button>
          <button className="btn btn-ghost" onClick={handleExportExcel} type="button" disabled={rows.length === 0}><FileSpreadsheet size={14} /> {t('reports.excel')}</button>
          <button className="btn btn-ghost" onClick={handleExportCsv} type="button" disabled={rows.length === 0}><FileText size={14} /> {t('reports.csv')}</button>
        </div>
      </div>

      <div className="card">
        {loading ? <div style={{ padding: 20 }}><SkeletonBlock height={220} /></div> : rows.length === 0 ? (
          <EmptyState icon={Clock}>{t('attendance.noRecords')}</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('attendance.colDate')}</th>
                  <th>{t('attendance.colEmployee')}</th>
                  <th>{t('attendance.colDepartment')}</th>
                  <th>{t('attendance.colStatus')}</th>
                  <th className="num">{t('attendance.colCheckIn')}</th>
                  <th className="num">{t('attendance.colCheckOut')}</th>
                  <th className="num">{t('attendance.colHours')}</th>
                  <th className="num">{t('attendance.colPunches')}</th>
                  <th>{t('attendance.colDevice')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const employee = row.first_name ? `${row.first_name} ${row.last_name || ''}` : t('attendance.unmatchedEmployee')
                  return (
                    <tr key={`${row.group_key}-${row.work_day}`}>
                      <td>{formatDate(row.work_day, i18n.language)}</td>
                      <td>
                        <div style={styles.name}>{employee}</div>
                        <div style={styles.muted}>{row.employee_code || t('attendance.deviceIdLabel', { id: row.device_user_id })}</div>
                      </td>
                      <td>{row.department || '-'}</td>
                      <td><Badge tone={STATUS_TONE[row.attendance_status] || 'muted'}>{t(`common.status.${row.attendance_status}`, row.attendance_status || '-')}</Badge></td>
                      <td className="num" style={{ color:'var(--accent2)' }}>{formatTime(row.check_in_at, i18n.language)}</td>
                      <td className="num" style={{ color: row.check_out_at ? 'var(--accent)' : 'var(--warn)' }}>
                        {formatTime(row.check_out_at, i18n.language)}
                      </td>
                      <td className="num">{formatHoursDuration(row.worked_hours)}</td>
                      <td className="num">{row.punch_count}</td>
                      <td>{Array.isArray(row.devices) && row.devices.length ? row.devices.join(', ') : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page:{display:'flex',flexDirection:'column',gap:20},
  filters:{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'},
  search:{display:'flex',alignItems:'center',gap:8,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:9,padding:'0 8px',height:38,minWidth:320},
  searchInput:{flex:1,background:'transparent',border:'none',outline:'none',color:'var(--text)',fontSize:13},
  searchBtn:{height:30,padding:'0 12px'},
  name:{fontWeight:600},
  muted:{color:'var(--muted)',fontSize:12},
}
