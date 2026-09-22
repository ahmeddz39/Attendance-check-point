import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Palmtree, Plus, Printer, Ban, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import DatePicker from '../components/DatePicker'
import { SkeletonTableRows } from '../components/Skeleton'
import { formatDate } from '../i18n/formatDate'
import { exportPdf } from '../utils/exportTable'
import { leaveFormHtml } from '../utils/leaveFormHtml'

const today = () => new Date().toISOString().slice(0, 10)

const blank = { employeeId: '', startDate: today(), endDate: today(), coveringEmployeeId: '', notes: '' }

const daysBetween = (start, end) => {
  if (!start || !end) return 0
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  return Math.round((e - s) / 86400000) + 1
}

const STATUS_TONE = { scheduled: 'accent', cancelled: 'muted' }

export default function Leave() {
  const { t, i18n } = useTranslation()
  const { authFetch, user } = useAuth()
  const { companyName, logoUrl } = useCompany()
  const [rows, setRows] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState(null) // 'add' | null
  const [form, setForm] = useState(blank)
  const [balance, setBalance] = useState(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    authFetch('/api/leaves')
      .then(r => r?.json())
      .then(d => setRows(Array.isArray(d?.data) ? d.data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    authFetch('/api/employees')
      .then(r => r?.json())
      .then(d => setEmployees(Array.isArray(d?.data) ? d.data : []))
  }, [authFetch])

  useEffect(() => {
    if (!form.employeeId) { setBalance(null); return }
    authFetch(`/api/leaves/balance/${form.employeeId}`)
      .then(r => r?.json())
      .then(d => setBalance(d?.data || null))
  }, [authFetch, form.employeeId])

  const reset = () => {
    setForm(blank)
    setPanel(null)
    setMessage('')
    setBalance(null)
  }

  const employeeName = (id) => {
    const e = employees.find(emp => emp.id === id)
    return e ? `${e.first_name} ${e.last_name || ''}`.trim() : ''
  }

  const save = async (e) => {
    e.preventDefault()
    setMessage('')
    setSaving(true)
    try {
      const res = await authFetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: form.employeeId,
          startDate: form.startDate,
          endDate: form.endDate,
          coveringEmployeeId: form.coveringEmployeeId || undefined,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res?.ok) throw new Error(data?.error?.message || t('leave.overlapError'))
      reset()
      load()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  const cancelLeave = async (leave) => {
    if (!window.confirm(t('leave.cancelConfirm'))) return
    await authFetch(`/api/leaves/${leave.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    load()
  }

  const deleteLeave = async (leave) => {
    if (!window.confirm(t('leave.deleteConfirm'))) return
    await authFetch(`/api/leaves/${leave.id}`, { method: 'DELETE' })
    load()
  }

  const printLeave = (leave) => {
    const labels = {
      title: t('leave.printFormTitle'),
      employeeLabel: t('leave.printEmployeeLabel'),
      codeLabel: t('leave.printCodeLabel'),
      departmentLabel: t('leave.printDepartmentLabel'),
      periodLabel: t('leave.printPeriodLabel'),
      daysLabel: t('leave.printDaysLabel'),
      coveringLabel: t('leave.printCoveringLabel'),
      signatureEmployee: t('leave.printSignatureEmployee'),
      signatureCovering: t('leave.printSignatureCovering'),
      approvedBy: t('leave.printApprovedBy'),
      dateLabel: t('leave.printDateLabel'),
    }
    const data = {
      employeeName: `${leave.employee_first_name} ${leave.employee_last_name || ''}`.trim(),
      employeeCode: leave.employee_code,
      department: leave.department,
      periodText: `${formatDate(leave.start_date, i18n.language)} — ${formatDate(leave.end_date, i18n.language)}`,
      daysCount: t('leave.balanceDays', { count: Number(leave.days_count) }),
      coveringName: leave.covering_first_name
        ? `${leave.covering_first_name} ${leave.covering_last_name || ''}`.trim()
        : null,
    }
    const branding = {
      companyName,
      logoUrl: logoUrl ? `${window.location.origin}${logoUrl}` : null,
      dir: i18n.dir(),
    }
    exportPdf(leaveFormHtml(data, labels, branding))
  }

  const requestedDays = daysBetween(form.startDate, form.endDate)
  const exceedsBalance = balance && requestedDays > balance.remaining

  return (
    <div style={styles.page} className="fade-in">
      <PageHeader
        title={t('leave.title')}
        subtitle={t('leave.subtitle')}
        actions={
          <button className="btn btn-primary" type="button" onClick={() => setPanel('add')}>
            <Plus size={14} /> {t('leave.scheduleBtn')}
          </button>
        }
      />

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('leave.colEmployee')}</th>
                <th>{t('leave.colCovering')}</th>
                <th>{t('leave.colStartDate')}</th>
                <th>{t('leave.colEndDate')}</th>
                <th className="num">{t('leave.colDays')}</th>
                <th>{t('leave.colStatus')}</th>
                <th>{t('leave.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonTableRows rows={5} cols={7} /> : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={Palmtree}>{t('leave.noRecords')}</EmptyState>
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={styles.name}>{row.employee_first_name} {row.employee_last_name}</div>
                    <div style={styles.muted}>{row.employee_code}</div>
                  </td>
                  <td>{row.covering_first_name ? `${row.covering_first_name} ${row.covering_last_name || ''}` : '-'}</td>
                  <td>{formatDate(row.start_date, i18n.language)}</td>
                  <td>{formatDate(row.end_date, i18n.language)}</td>
                  <td className="num">{Number(row.days_count)}</td>
                  <td><Badge tone={STATUS_TONE[row.status] || 'muted'}>{t(`leave.status${row.status === 'scheduled' ? 'Scheduled' : 'Cancelled'}`)}</Badge></td>
                  <td>
                    <div style={styles.actions}>
                      <button className="btn btn-ghost" type="button" onClick={() => printLeave(row)} title={t('leave.print')}>
                        <Printer size={14} />
                      </button>
                      {row.status === 'scheduled' && (
                        <button className="btn btn-ghost" type="button" onClick={() => cancelLeave(row)} title={t('leave.cancel')}>
                          <Ban size={14} />
                        </button>
                      )}
                      {user?.role === 'admin' && (
                        <button className="btn btn-ghost" type="button" onClick={() => deleteLeave(row)} title={t('leave.delete')}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={panel === 'add'}
        onClose={reset}
        title={t('leave.scheduleTitle')}
        footer={
          <>
            <button type="button" onClick={reset} className="btn btn-ghost">{t('common.cancel')}</button>
            <button type="submit" form="leave-form" className="btn btn-primary" disabled={saving}>
              {saving ? t('leave.saving') : t('leave.save')}
            </button>
          </>
        }
      >
        <form id="leave-form" onSubmit={save} style={formShell}>
          <SelectField
            label={t('leave.employeeLabel')}
            required
            value={form.employeeId}
            onChange={(value) => setForm(prev => ({ ...prev, employeeId: value }))}
            options={[{ value: '', label: '' }, ...employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name || ''}` }))]}
          />

          <div style={grid}>
            <DateField label={t('leave.startDateLabel')} value={form.startDate} onChange={(value) => setForm(prev => ({ ...prev, startDate: value }))} />
            <DateField label={t('leave.endDateLabel')} value={form.endDate} onChange={(value) => setForm(prev => ({ ...prev, endDate: value }))} />
          </div>

          <SelectField
            label={t('leave.coveringLabel')}
            value={form.coveringEmployeeId}
            onChange={(value) => setForm(prev => ({ ...prev, coveringEmployeeId: value }))}
            options={[
              { value: '', label: t('leave.coveringPlaceholder') },
              ...employees.filter(e => e.id !== form.employeeId).map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name || ''}` })),
            ]}
          />

          <label style={field}>
            <span style={labelText}>{t('leave.notesLabel')}</span>
            <textarea
              className="input" rows={2}
              value={form.notes}
              placeholder={t('leave.notesPlaceholder')}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </label>

          {balance && (
            <div style={styles.balanceBox}>
              <span>{t('leave.balanceAccrued')}: <strong>{t('leave.balanceDays', { count: balance.accrued + balance.adjustment })}</strong></span>
              <span>{t('leave.balanceConsumed')}: <strong>{t('leave.balanceDays', { count: balance.consumed })}</strong></span>
              <span>{t('leave.balanceRemaining')}: <strong>{t('leave.balanceDays', { count: balance.remaining })}</strong></span>
            </div>
          )}

          {exceedsBalance && <div style={styles.warning}>{t('leave.warningExceedsBalance')}</div>}
          {message && <div style={styles.error}>{message}</div>}
        </form>
      </Modal>
    </div>
  )
}

function DateField({ label, value, onChange }) {
  return (
    <label style={field}>
      <span style={labelText}>{label}</span>
      <DatePicker value={value} onChange={onChange} />
    </label>
  )
}

function SelectField({ label, value, onChange, options, required }) {
  return (
    <label style={field}>
      <span style={labelText}>{label} {required ? <span style={{ color: 'var(--danger)' }}>*</span> : null}</span>
      <select className="select" value={value} required={required} onChange={(event) => onChange(event.target.value)}>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  name: { fontWeight: 600 },
  muted: { color: 'var(--muted)', fontSize: 12 },
  actions: { display: 'flex', gap: 6 },
  balanceBox: {
    display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)',
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px',
  },
  warning: {
    background: 'var(--warn-soft)', border: '1px solid var(--warn)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--warn)', fontSize: 13,
  },
  error: { color: 'var(--danger)', fontSize: 13 },
}

const field = { display: 'flex', flexDirection: 'column', gap: 6 }
const labelText = { fontSize: 12, color: 'var(--muted)' }
const formShell = { display: 'flex', flexDirection: 'column', gap: 14 }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px 16px' }
