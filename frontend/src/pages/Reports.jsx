import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, FileSpreadsheet, FileText, Search, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import SegmentedControl from '../components/SegmentedControl'
import MonthPicker from '../components/MonthPicker'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { SkeletonBlock } from '../components/Skeleton'
import { formatDate, formatTime, formatDateTime } from '../i18n/formatDate'
import useAutoRefresh from '../hooks/useAutoRefresh'
import { tableHtml, downloadBlob, exportPdf, toCsv } from '../utils/exportTable'

const currentMonth = () => new Date().toISOString().slice(0, 7)
const money = (value) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} DZD`
const hours = (value) => Number(value || 0).toFixed(2)
const salaryType = (row = {}) => row.salary_type || row.salaryType || 'hourly'
const salaryRate = (row = {}) => {
  const type = row.salary_type || row.salaryType || 'hourly'
  return type === 'monthly' ? money(row.monthly_salary ?? row.rate) : money(row.hourly_rate ?? row.rate)
}

const STATUS_TONE = { present: 'accent', late: 'accent2', early: 'warn', absent: 'danger', incomplete: 'warn', unmatched: 'muted' }

export default function Reports() {
  const { t, i18n } = useTranslation()
  const { authFetch } = useAuth()
  const { companyName, logoUrl } = useCompany()
  const [mode, setMode] = useState('monthly')
  const [month, setMonth] = useState(currentMonth())
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [monthly, setMonthly] = useState(null)
  const [employeeReport, setEmployeeReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  const MODES = [
    { value: 'monthly',  label: t('reports.modeMonthly'),  icon: CalendarDays },
    { value: 'employee', label: t('reports.modeEmployee'), icon: UserRound },
  ]

  const SORT_COLUMNS = [
    { key: 'name', label: t('reports.sortEmployee') },
    { key: 'department', label: t('reports.sortDepartment') },
    { key: 'present_days', label: t('reports.sortPresent') },
    { key: 'absent_days', label: t('reports.sortAbsent') },
    { key: 'late_days', label: t('reports.sortLate') },
    { key: 'overtime_hours', label: t('reports.sortOtHrs') },
    { key: 'final_salary', label: t('reports.sortFinalSalary') },
  ]

  const filteredRows = useMemo(() => {
    let rows = monthly?.rows || []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(row =>
        `${row.first_name} ${row.last_name || ''}`.toLowerCase().includes(q) ||
        (row.employee_code || '').toLowerCase().includes(q) ||
        (row.department || '').toLowerCase().includes(q)
      )
    }
    if (sort.key) {
      rows = [...rows].sort((a, b) => {
        const av = sort.key === 'name' ? `${a.first_name} ${a.last_name || ''}` : a[sort.key]
        const bv = sort.key === 'name' ? `${b.first_name} ${b.last_name || ''}` : b[sort.key]
        const an = Number(av), bn = Number(bv)
        const cmp = !Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== ''
          ? an - bn
          : String(av || '').localeCompare(String(bv || ''))
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [monthly, search, sort])

  const departmentRollup = useMemo(() => {
    const rows = monthly?.rows || []
    const map = new Map()
    for (const row of rows) {
      const dept = row.department?.trim() || t('reports.unassigned')
      if (!map.has(dept)) {
        map.set(dept, { department: dept, employees: 0, presentDays: 0, absentDays: 0, lateDays: 0, overtimeHours: 0, finalSalary: 0 })
      }
      const d = map.get(dept)
      d.employees += 1
      d.presentDays += Number(row.present_days || 0)
      d.absentDays += Number(row.absent_days || 0)
      d.lateDays += Number(row.late_days || 0)
      d.overtimeHours += Number(row.overtime_hours || 0)
      d.finalSalary += Number(row.final_salary || 0)
    }
    return Array.from(map.values()).sort((a, b) => b.employees - a.employees)
  }, [monthly, i18n.language])

  const toggleSort = (key) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const currentExport = () => {
    if (mode === 'monthly') {
      const rows = filteredRows.map(row => [
        `${row.first_name} ${row.last_name || ''}`,
        row.employee_code,
        row.department || '-',
        row.present_days,
        row.absent_days,
        row.late_days,
        hours(row.regular_hours),
        hours(row.overtime_hours),
        money(row.overtime_pay),
        t(`common.${salaryType(row)}`),
        salaryRate(row),
        money(row.final_salary),
      ])
      return {
        title: t('reports.monthlyReportTitle', { month }),
        headers: [
          t('reports.sortEmployee'), t('reports.colCode'), t('reports.sortDepartment'),
          t('reports.sumPresentDays'), t('reports.sumAbsentDays'), t('reports.sumLateDays'),
          { label: t('reports.sumRegularHours'), kind: 'hours' },
          { label: t('reports.sumOvertimeHours'), kind: 'hours' },
          t('reports.sumOvertimePay'), t('reports.colSalaryType'), t('reports.colRate'), t('reports.sumFinalSalary'),
        ],
        rows,
        filename: `monthly-attendance-${month}`,
      }
    }

    const employee = employeeReport?.employee
    const rows = (employeeReport?.rows || []).map(row => [
      formatDate(row.work_day, i18n.language),
      t(`common.status.${row.attendance_status}`, row.attendance_status || '-'),
      formatTime(row.check_in_at, i18n.language),
      formatTime(row.check_out_at, i18n.language),
      hours(row.worked_hours),
      row.punch_count,
      Array.isArray(row.devices) && row.devices.length ? row.devices.join(', ') : '-',
    ])
    return {
      title: t('reports.employeeReportTitle', { name: employee ? `${employee.first_name} ${employee.last_name || ''}` : '', month }),
      headers: [
        t('reports.colDate'), t('reports.colStatus'),
        { label: t('reports.colCheckIn'), kind: 'checkin' },
        { label: t('reports.colCheckOut'), kind: 'checkout' },
        { label: t('reports.colHours'), kind: 'hours' },
        t('reports.colPunches'), t('reports.colDevice'),
      ],
      rows,
      filename: `employee-attendance-${employee?.employee_code || 'report'}-${month}`,
    }
  }

  const handleExportPdf = () => {
    const report = currentExport()
    const branding = {
      companyName,
      logoUrl: logoUrl ? `${window.location.origin}${logoUrl}` : null,
      dir: i18n.dir(),
      generatedLabel: t('reports.exportGeneratedOn', { date: formatDateTime(new Date(), i18n.language) }),
      recordsLabel: t('reports.exportRecordCount', { count: report.rows.length }),
    }
    exportPdf(tableHtml(report.title, report.headers, report.rows, branding))
  }

  const handleExportExcel = () => {
    const report = currentExport()
    // No logoUrl here: Excel's HTML import treats <img> as a floating OLE object that
    // ignores the CSS width/height, and shows an unrelated placeholder graphic if it
    // can't fetch the URL at open-time -- both corrupt the sheet. Text branding only.
    const branding = {
      companyName,
      dir: i18n.dir(),
      generatedLabel: t('reports.exportGeneratedOn', { date: formatDateTime(new Date(), i18n.language) }),
      recordsLabel: t('reports.exportRecordCount', { count: report.rows.length }),
    }
    downloadBlob(
      tableHtml(report.title, report.headers, report.rows, branding),
      `${report.filename}.xls`,
      'application/vnd.ms-excel'
    )
  }

  const handleExportCsv = () => {
    const report = currentExport()
    downloadBlob(toCsv(report.headers, report.rows), `${report.filename}.csv`, 'text/csv;charset=utf-8;')
  }

  useEffect(() => {
    authFetch('/api/employees')
      .then(r => r?.json())
      .then(d => {
        const list = d?.data || []
        setEmployees(list)
        if (!employeeId && list[0]) setEmployeeId(list[0].id)
      })
    authFetch('/api/devices')
      .then(r => r?.json())
      .then(d => setDevices(Array.isArray(d?.data) ? d.data : []))
  }, [authFetch])

  const filteredEmployees = useMemo(() => (
    deviceId ? employees.filter(e => e.primary_device_id === deviceId) : employees
  ), [employees, deviceId])

  useEffect(() => {
    if (filteredEmployees.length && !filteredEmployees.some(e => e.id === employeeId)) {
      setEmployeeId(filteredEmployees[0].id)
    }
  }, [filteredEmployees])

  const loadMonthly = (silent = false) => {
    if (!silent) setLoading(true)
    const params = new URLSearchParams({ month })
    if (deviceId) params.set('deviceId', deviceId)
    authFetch(`/api/attendance/reports/monthly?${params.toString()}`)
      .then(r => r?.json())
      .then(d => setMonthly(d?.data || null))
      .finally(() => setLoading(false))
  }

  const loadEmployee = (silent = false) => {
    if (!employeeId) return
    if (!silent) setLoading(true)
    authFetch(`/api/attendance/reports/employees/${employeeId}?month=${month}`)
      .then(r => r?.json())
      .then(d => setEmployeeReport(d?.data || null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (mode === 'monthly') loadMonthly()
    if (mode === 'employee' && employeeId) loadEmployee()
  }, [mode, month, employeeId, deviceId])

  useAutoRefresh(() => {
    if (mode === 'monthly') loadMonthly(true)
    if (mode === 'employee' && employeeId) loadEmployee(true)
  }, 60000)

  return (
    <div style={styles.page} className="fade-in">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <div style={styles.toolbar}>
        <SegmentedControl options={MODES} value={mode} onChange={setMode} />

        <MonthPicker value={month} onChange={setMonth} />

        {devices.length > 0 && (
          <select className="select" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
            <option value="">{t('common.allDevices')}</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        {mode === 'employee' && (
          <select className="select" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            {filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name || ''} ({e.employee_code})</option>)}
          </select>
        )}

        {mode === 'monthly' && (
          <div style={styles.search}>
            <Search size={15} color="var(--muted)" />
            <input
              style={styles.searchInput}
              placeholder={t('reports.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn-ghost" onClick={handleExportPdf} type="button"><Download size={14} /> {t('reports.pdf')}</button>
          <button className="btn btn-ghost" onClick={handleExportExcel} type="button"><FileSpreadsheet size={14} /> {t('reports.excel')}</button>
          <button className="btn btn-ghost" onClick={handleExportCsv} type="button"><FileText size={14} /> {t('reports.csv')}</button>
        </div>
      </div>

      {loading ? <SkeletonBlock height={280} /> : mode === 'monthly' ? (
        <MonthlyReport data={monthly} rows={filteredRows} departmentRollup={departmentRollup} sort={sort} onSort={toggleSort} t={t} sortColumns={SORT_COLUMNS} />
      ) : (
        <EmployeeReport data={employeeReport} t={t} lng={i18n.language} />
      )}
    </div>
  )
}

function SortableTh({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey
  return (
    <th className={className} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort(sortKey)}>
      {label}{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

function MonthlyReport({ data, rows, departmentRollup, sort, onSort, t, sortColumns }) {
  return (
    <>
      <div style={styles.summaryGrid}>
        <Summary label={t('reports.sumEmployees')} value={data?.totals?.employees || 0} />
        <Summary label={t('reports.sumPresentDays')} value={data?.totals?.presentDays || 0} />
        <Summary label={t('reports.sumAbsentDays')} value={data?.totals?.absentDays || 0} />
        <Summary label={t('reports.sumLateDays')} value={data?.totals?.lateDays || 0} />
        <Summary label={t('reports.sumOvertimeHours')} value={hours(data?.totals?.overtimeHours)} />
        <Summary label={t('reports.sumOvertimePay')} value={money(data?.totals?.overtimePay)} />
        <Summary label={t('reports.sumFinalSalary')} value={money(data?.totals?.finalSalary)} />
      </div>

      {departmentRollup.length > 1 && (
        <div className="card">
          <div style={styles.cardHeaderPad}><span style={styles.cardHeaderTitle}>{t('reports.byDepartment')}</span></div>
          <table className="table">
            <thead><tr>
              <th>{t('reports.sortDepartment')}</th>
              <th className="num">{t('reports.colDeptEmployees')}</th>
              <th className="num">{t('reports.colDeptPresentDays')}</th>
              <th className="num">{t('reports.colDeptAbsentDays')}</th>
              <th className="num">{t('reports.colDeptLateDays')}</th>
              <th className="num">{t('reports.colDeptOtHours')}</th>
              <th className="num">{t('reports.colDeptTotalSalary')}</th>
            </tr></thead>
            <tbody>
              {departmentRollup.map(d => (
                <tr key={d.department}>
                  <td><b>{d.department}</b></td>
                  <td className="num">{d.employees}</td>
                  <td className="num">{d.presentDays}</td>
                  <td className="num" style={{ color: d.absentDays > 0 ? 'var(--warn)' : 'var(--muted)' }}>{d.absentDays}</td>
                  <td className="num">{d.lateDays > 0 ? <Badge tone="accent2">{d.lateDays}</Badge> : <span style={{ color: 'var(--muted)' }}>0</span>}</td>
                  <td className="num">{hours(d.overtimeHours)}</td>
                  <td className="num" style={{ color: 'var(--accent)' }}>{money(d.finalSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              {sortColumns.map(c => <SortableTh key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={onSort} className={c.key === 'name' || c.key === 'department' ? '' : 'num'} />)}
              <th className="num">{t('reports.colIncomplete')}</th>
              <th className="num">{t('reports.colRegularHrs')}</th>
              <th className="num">{t('reports.colOtPay')}</th>
              <th>{t('reports.colSalaryType')}</th>
              <th className="num">{t('reports.colRate')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td><b>{row.first_name} {row.last_name || ''}</b><div style={styles.muted}>{row.employee_code}</div></td>
                <td>{row.department || '-'}</td>
                <td className="num">{row.present_days}</td>
                <td className="num" style={{color:Number(row.absent_days) > 0 ? 'var(--warn)' : 'var(--muted)'}}>{row.absent_days}</td>
                <td className="num">{Number(row.late_days) > 0 ? <Badge tone="accent2">{row.late_days}</Badge> : <span style={{color:'var(--muted)'}}>0</span>}</td>
                <td className="num" style={{color: Number(row.overtime_hours) > 0 ? 'var(--accent2)' : 'var(--muted)'}}>{hours(row.overtime_hours)}</td>
                <td className="num" style={{color:'var(--accent)'}}>{money(row.final_salary)}</td>
                <td className="num" style={{color:Number(row.incomplete_days) > 0 ? 'var(--warn)' : 'var(--muted)'}}>{row.incomplete_days}</td>
                <td className="num">{hours(row.regular_hours)}</td>
                <td className="num" style={{color: Number(row.overtime_pay) > 0 ? 'var(--accent2)' : 'var(--muted)'}}>{money(row.overtime_pay)}</td>
                <td><Badge tone="accent2">{t(`common.${salaryType(row)}`)}</Badge></td>
                <td className="num">{salaryRate(row)} {salaryType(row) === 'monthly' ? t('common.perMonth') : t('common.perHour')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState icon={UserRound}>{t('reports.noDataFilter')}</EmptyState>}
      </div>
    </>
  )
}

function EmployeeReport({ data, t, lng }) {
  const rows = data?.rows || []
  const employee = data?.employee
  const salaryRuleText = (summary) => summary ? `${salaryRate(summary)} ${salaryType(summary) === 'monthly' ? t('common.perMonth') : t('common.perHour')}` : '-'
  return (
    <>
      <div style={styles.summaryGrid}>
        <Summary label={t('reports.sumEmployee')} value={employee ? `${employee.first_name} ${employee.last_name || ''}` : '-'} />
        <Summary label={t('reports.sumSalaryType')} value={data?.summary ? t(`common.${salaryType(data.summary)}`) : '-'} />
        <Summary label={t('reports.sumRate')} value={salaryRuleText(data?.summary)} />
        <Summary label={t('reports.sumPresentDays')} value={data?.summary?.presentDays || 0} />
        <Summary label={t('reports.sumAbsentDays')} value={data?.summary?.absentDays || 0} />
        <Summary label={t('reports.sumLateDays')} value={data?.summary?.lateDays || 0} />
        <Summary label={t('reports.sumIncompleteDays')} value={data?.summary?.incompleteDays || 0} />
        <Summary label={t('reports.sumRegularHours')} value={hours(data?.summary?.regularHours)} />
        <Summary label={t('reports.sumOvertimeHours')} value={hours(data?.summary?.overtimeHours)} />
        <Summary label={t('reports.sumOvertimePay')} value={money(data?.summary?.overtimePay)} />
        <Summary label={t('reports.sumFinalSalary')} value={money(data?.summary?.finalSalary)} />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>{t('reports.colDate')}</th>
              <th>{t('reports.colStatus')}</th>
              <th className="num">{t('reports.colCheckIn')}</th>
              <th className="num">{t('reports.colCheckOut')}</th>
              <th className="num">{t('reports.colHours')}</th>
              <th className="num">{t('reports.colPunches')}</th>
              <th>{t('reports.colDevice')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.work_day}>
                <td>{formatDate(row.work_day, lng)}</td>
                <td><Badge tone={STATUS_TONE[row.attendance_status] || 'muted'}>{t(`common.status.${row.attendance_status}`, row.attendance_status || '-')}</Badge></td>
                <td className="num" style={{color:'var(--accent2)'}}>{formatTime(row.check_in_at, lng)}</td>
                <td className="num" style={{color:row.check_out_at ? 'var(--accent)' : 'var(--warn)'}}>{formatTime(row.check_out_at, lng)}</td>
                <td className="num">{hours(row.worked_hours)}</td>
                <td className="num">{row.punch_count}</td>
                <td>{Array.isArray(row.devices) && row.devices.length ? row.devices.join(', ') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState icon={CalendarDays}>{t('reports.noAttendanceLogs')}</EmptyState>}
      </div>
    </>
  )
}

function Summary({ label, value }) {
  return (
    <div className="card" style={styles.summary}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  )
}

const styles = {
  page:{display:'flex',flexDirection:'column',gap:20},
  toolbar:{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'},
  search:{display:'flex',alignItems:'center',gap:8,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:9,padding:'0 10px',height:38,minWidth:260},
  searchInput:{flex:1,background:'transparent',border:'none',outline:'none',color:'var(--text)',fontSize:13,height:'100%'},
  summaryGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12},
  summary:{padding:'16px 18px'},
  summaryLabel:{fontSize:11,color:'var(--muted)',textTransform:'uppercase',marginBottom:6},
  summaryValue:{fontSize:18,fontWeight:700,fontFamily:'var(--mono)',color:'var(--text)'},
  muted:{color:'var(--muted)',fontSize:12},
  cardHeaderPad:{padding:'16px 16px 0'},
  cardHeaderTitle:{fontSize:14,fontWeight:600},
}
