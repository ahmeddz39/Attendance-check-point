import { useEffect, useMemo, useState } from 'react'
import { Search, Clock, Download, FileSpreadsheet, FileText, ClipboardEdit } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import SegmentedControl from '../components/SegmentedControl'
import DatePicker from '../components/DatePicker'
import MonthPicker from '../components/MonthPicker'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { SkeletonBlock } from '../components/Skeleton'
import { formatDate, formatTime, formatDateTime, formatHoursDuration } from '../i18n/formatDate'
import { tableHtml, downloadBlob, exportPdf, toCsv } from '../utils/exportTable'
import useAutoRefresh from '../hooks/useAutoRefresh'

const today = () => new Date().toISOString().slice(0, 10)
const month = () => new Date().toISOString().slice(0, 7)

const STATUS_TONE = { present: 'accent', late: 'accent2', early: 'warn', absent: 'danger', incomplete: 'warn', unmatched: 'muted', on_leave: 'info', sick: 'warn', unjustified: 'danger' }
const JUSTIFIABLE = ['absent', 'sick', 'unjustified']

// row.work_day is a UTC timestamp representing local midnight -- extract the
// LOCAL calendar date (matching what formatDate already displays) rather
// than slicing the UTC ISO string, which would land on the wrong day.
const localDateOf = (workDay) => {
  const d = new Date(workDay)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
  const [employees, setEmployees] = useState([])
  const [justifyRow, setJustifyRow] = useState(null)
  const [justifyForm, setJustifyForm] = useState({ reason: 'sick', paid: true, coveringEmployeeId: '', notes: '' })
  const [justifySaving, setJustifySaving] = useState(false)
  const [justifyMessage, setJustifyMessage] = useState('')

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
    authFetch('/api/employees')
      .then(r => r?.json())
      .then(d => setEmployees(Array.isArray(d?.data) ? d.data : []))
  }, [authFetch])

  useEffect(() => { load() }, [authFetch, range.from, range.to, deviceId])
  useAutoRefresh(() => load(true), 60000)

  const submitSearch = (e) => {
    e.preventDefault()
    load()
  }

  const openJustify = (row) => {
    setJustifyRow(row)
    setJustifyForm({ reason: row.attendance_status === 'unjustified' ? 'unjustified' : 'sick', paid: row.justification_paid ?? true, coveringEmployeeId: '', notes: '' })
    setJustifyMessage('')
  }

  const closeJustify = () => {
    setJustifyRow(null)
    setJustifyMessage('')
  }

  const setJustifyReason = (reason) => {
    setJustifyForm(prev => ({ ...prev, reason, paid: reason === 'sick' ? true : reason === 'unjustified' ? false : prev.paid }))
  }

  const saveJustify = async (e) => {
    e.preventDefault()
    setJustifyMessage('')
    setJustifySaving(true)
    try {
      const date = localDateOf(justifyRow.work_day)
      let res
      if (justifyForm.reason === 'vacation') {
        res = await authFetch('/api/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: justifyRow.employee_id,
            startDate: date,
            endDate: date,
            coveringEmployeeId: justifyForm.coveringEmployeeId || undefined,
            notes: justifyForm.notes || undefined,
          }),
        })
      } else {
        res = await authFetch('/api/absence-justifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: justifyRow.employee_id,
            date,
            reason: justifyForm.reason,
            paid: justifyForm.paid,
            notes: justifyForm.notes || undefined,
          }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res?.ok) throw new Error(data?.error?.message || t('attendance.justifyTitle'))
      closeJustify()
      load()
    } catch (err) {
      setJustifyMessage(err.message)
    } finally {
      setJustifySaving(false)
    }
  }

  const removeJustification = async () => {
    if (!window.confirm(t('common.delete'))) return
    setJustifySaving(true)
    try {
      const date = localDateOf(justifyRow.work_day)
      const params = new URLSearchParams({ employeeId: justifyRow.employee_id, date })
      await authFetch(`/api/absence-justifications?${params.toString()}`, { method: 'DELETE' })
      closeJustify()
      load()
    } finally {
      setJustifySaving(false)
    }
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
                  <th>{t('attendance.colActions')}</th>
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
                      <td>
                        <div style={styles.statusCell}>
                          <Badge tone={STATUS_TONE[row.attendance_status] || 'muted'}>{t(`common.status.${row.attendance_status}`, row.attendance_status || '-')}</Badge>
                          {['sick', 'unjustified'].includes(row.attendance_status) && (
                            <Badge tone={row.justification_paid ? 'accent' : 'muted'}>
                              {row.justification_paid ? t('attendance.paidYes') : t('attendance.paidNo')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="num" style={{ color:'var(--accent2)' }}>{formatTime(row.check_in_at, i18n.language)}</td>
                      <td className="num" style={{ color: row.check_out_at ? 'var(--accent)' : 'var(--warn)' }}>
                        {formatTime(row.check_out_at, i18n.language)}
                      </td>
                      <td className="num">{formatHoursDuration(row.worked_hours)}</td>
                      <td className="num">{row.punch_count}</td>
                      <td>{Array.isArray(row.devices) && row.devices.length ? row.devices.join(', ') : '-'}</td>
                      <td>
                        {row.employee_id && JUSTIFIABLE.includes(row.attendance_status) && (
                          <button className="btn btn-ghost" type="button" onClick={() => openJustify(row)} title={t('attendance.justifyAction')}>
                            <ClipboardEdit size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!justifyRow}
        onClose={closeJustify}
        title={t('attendance.justifyTitle')}
        subtitle={justifyRow ? (
          <>
            {justifyRow.first_name} {justifyRow.last_name || ''} —{' '}
            {/* en-GB (not i18n.language) on purpose: ICU embeds RTL marks into
                ar-DZ-formatted dates for direct RTL embedding, which fight a
                dir="ltr" isolate instead of cooperating with it -- a plain,
                mark-free digit string sidesteps that entirely. */}
            <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{new Date(justifyRow.work_day).toLocaleDateString('en-GB')}</span>
          </>
        ) : ''}
        footer={
          <>
            {justifyRow && ['sick', 'unjustified'].includes(justifyRow.attendance_status) && (
              <button type="button" onClick={removeJustification} className="btn btn-ghost" style={{ marginInlineEnd: 'auto' }} disabled={justifySaving}>
                {t('common.delete')}
              </button>
            )}
            <button type="button" onClick={closeJustify} className="btn btn-ghost">{t('common.cancel')}</button>
            <button type="submit" form="justify-form" className="btn btn-primary" disabled={justifySaving}>
              {justifySaving ? t('leave.saving') : t('leave.save')}
            </button>
          </>
        }
      >
        {justifyRow && (
          <form id="justify-form" onSubmit={saveJustify} style={formShell}>
            <label style={field}>
              <span style={labelText}>{t('attendance.reasonLabel')}</span>
              <SegmentedControl
                options={[
                  { value: 'vacation', label: t('attendance.reasonVacation') },
                  { value: 'sick', label: t('attendance.reasonSick') },
                  { value: 'unjustified', label: t('attendance.reasonUnjustified') },
                ]}
                value={justifyForm.reason}
                onChange={setJustifyReason}
              />
            </label>

            {justifyForm.reason === 'vacation' ? (
              <label style={field}>
                <span style={labelText}>{t('leave.coveringLabel')}</span>
                <select
                  className="select"
                  value={justifyForm.coveringEmployeeId}
                  onChange={e => setJustifyForm(prev => ({ ...prev, coveringEmployeeId: e.target.value }))}
                >
                  <option value="">{t('leave.coveringPlaceholder')}</option>
                  {employees.filter(emp => emp.id !== justifyRow.employee_id).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name || ''}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label style={field}>
                <span style={labelText}>{t('attendance.paidLabel')}</span>
                <SegmentedControl
                  options={[
                    { value: true, label: t('attendance.paidYes') },
                    { value: false, label: t('attendance.paidNo') },
                  ]}
                  value={justifyForm.paid}
                  onChange={(value) => setJustifyForm(prev => ({ ...prev, paid: value }))}
                />
              </label>
            )}

            <label style={field}>
              <span style={labelText}>{t('leave.notesLabel')}</span>
              <textarea
                className="input" rows={2}
                value={justifyForm.notes}
                placeholder={t('leave.notesPlaceholder')}
                onChange={e => setJustifyForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </label>

            {justifyMessage && <div style={styles.error}>{justifyMessage}</div>}
          </form>
        )}
      </Modal>
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
  error:{color:'var(--danger)',fontSize:13},
  statusCell:{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'},
}

const field = { display: 'flex', flexDirection: 'column', gap: 6 }
const labelText = { fontSize: 12, color: 'var(--muted)' }
const formShell = { display: 'flex', flexDirection: 'column', gap: 14 }
