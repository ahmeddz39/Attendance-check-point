import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Pencil, Plus, Save, Table2, Trash2, X, Users } from 'lucide-react'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SegmentedControl from '../components/SegmentedControl'
import { localeFor } from '../i18n/formatDate'

const blank = {
  employeeCode: '',
  deviceUserId: '',
  firstName: '',
  lastName: '',
  department: '',
  position: '',
  salaryType: 'hourly',
  hourlyRate: 0,
  monthlySalary: 0,
  standardHours: 160,
  deviceUid: '',
  deviceRole: '',
  cardNumber: '',
  primaryDeviceId: '',
  leaveBalanceAdjustment: 0,
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] // ISODOW: 1=Mon..7=Sun
const DEFAULT_SHIFT = { shiftStart: '08:00', shiftEnd: '17:00' }
const defaultShiftDays = () => WEEKDAYS.map((weekday) => ({ weekday, isWorking: weekday <= 5, ...DEFAULT_SHIFT }))
const weekdayLabel = (weekday, locale) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2023, 0, 1 + weekday))

const money = (value) =>
  `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} DZD`

export default function Employees() {
  const { t, i18n } = useTranslation()
  const { authFetch, user: me } = useAuth()
  const isAdmin = me?.role === 'admin'
  const [employees, setEmployees] = useState([])
  const [devices, setDevices] = useState([])
  const [panel, setPanel] = useState(null) // 'add' | { type:'edit', employee } | null
  const [form, setForm] = useState(blank)
  const [message, setMessage] = useState('')

  const [shiftMode, setShiftMode] = useState('default') // 'default' | 'standard' | 'perDay'
  const [shiftStandard, setShiftStandard] = useState(DEFAULT_SHIFT)
  const [shiftDays, setShiftDays] = useState(defaultShiftDays)
  const [leaveBalance, setLeaveBalance] = useState(null)
  const locale = localeFor(i18n.language)

  const [bulkMode, setBulkMode] = useState(false)
  const [bulkEdits, setBulkEdits] = useState({})
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkMessage, setBulkMessage] = useState('')

  const load = () =>
    authFetch('/api/employees')
      .then((r) => r?.json())
      .then((d) => setEmployees(Array.isArray(d?.data) ? d.data : []))

  useEffect(() => {
    load()
    authFetch('/api/devices')
      .then((r) => r?.json())
      .then((d) => setDevices(Array.isArray(d?.data) ? d.data : []))
  }, [authFetch])

  const reset = () => {
    setForm(blank)
    setPanel(null)
    setMessage('')
    setShiftMode('default')
    setShiftStandard(DEFAULT_SHIFT)
    setShiftDays(defaultShiftDays())
    setLeaveBalance(null)
  }

  const openAdd = () => {
    setForm(blank)
    setPanel('add')
    setShiftMode('default')
    setShiftStandard(DEFAULT_SHIFT)
    setShiftDays(defaultShiftDays())
    setLeaveBalance(null)
  }

  const openEdit = async (employee) => {
    setPanel({ type: 'edit', employee })
    setForm({
      employeeCode: employee.employee_code || '',
      deviceUserId: employee.device_user_id || '',
      deviceUid: employee.device_uid || '',
      deviceRole: String(employee.device_role ?? ''),
      cardNumber: employee.card_number || '',
      primaryDeviceId: employee.primary_device_id || '',
      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      department: employee.department || '',
      position: employee.position || '',
      salaryType: employee.salary_type,
      hourlyRate: employee.hourly_rate || 0,
      monthlySalary: employee.monthly_salary || 0,
      standardHours: employee.standard_hours || 160,
      leaveBalanceAdjustment: employee.leave_balance_adjustment || 0,
    })

    setShiftMode('default')
    setShiftStandard(DEFAULT_SHIFT)
    setShiftDays(defaultShiftDays())

    authFetch(`/api/leaves/balance/${employee.id}`)
      .then((r) => r?.json())
      .then((d) => setLeaveBalance(d?.data || null))

    const res = await authFetch(`/api/employees/${employee.id}/shifts`)
    const data = await res?.json().catch(() => null)
    const payload = data?.data
    if (!payload) return

    setShiftDays(payload.days)
    if (payload.usesCompanyDefault) {
      setShiftMode('default')
    } else {
      const [first] = payload.days
      const allSameAsStandard = payload.days.every(
        (d) => d.isWorking && d.shiftStart === first.shiftStart && d.shiftEnd === first.shiftEnd
      )
      if (allSameAsStandard) {
        setShiftMode('standard')
        setShiftStandard({ shiftStart: first.shiftStart, shiftEnd: first.shiftEnd })
      } else {
        setShiftMode('perDay')
      }
    }
  }

  const updateShiftDay = (index, field, value) => {
    setShiftDays((prev) => prev.map((day, i) => (i === index ? { ...day, [field]: value } : day)))
  }

  const save = async (e) => {
    e.preventDefault()
    setMessage('')

    const isEdit = panel && panel.type === 'edit'
    const employeeId = isEdit ? panel.employee.id : null

    const payload = {
      ...form,
      deviceUid: form.deviceUid === '' ? null : Number(form.deviceUid),
      deviceRole: form.deviceRole === '' ? null : Number(form.deviceRole),
      primaryDeviceId: form.primaryDeviceId === '' ? null : form.primaryDeviceId,
      hourlyRate: Number(form.hourlyRate || 0),
      monthlySalary: Number(form.monthlySalary || 0),
      standardHours: Number(form.standardHours || 0),
      leaveBalanceAdjustment: Number(form.leaveBalanceAdjustment || 0),
    }

    const url = isEdit ? `/api/employees/${employeeId}` : '/api/employees'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await authFetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res?.json().catch(() => ({}))
    if (!res?.ok) {
      return setMessage(
        typeof data === 'object' && data !== null && data.error
          ? data.error.message || t('employees.couldNotSave')
          : t('employees.couldNotSave')
      )
    }

    const savedEmployeeId = isEdit ? employeeId : data?.data?.id
    if (savedEmployeeId) {
      const shiftPayload = shiftMode === 'default'
        ? { useCompanyDefault: true }
        : {
            days: shiftMode === 'standard'
              ? WEEKDAYS.map((weekday) => ({ weekday, isWorking: true, ...shiftStandard }))
              : shiftDays.map(({ weekday, isWorking, shiftStart, shiftEnd }) => ({ weekday, isWorking, shiftStart, shiftEnd })),
          }
      await authFetch(`/api/employees/${savedEmployeeId}/shifts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftPayload),
      })
    }

    let pushMessage = ''
    if (savedEmployeeId && isAdmin && form.primaryDeviceId && form.deviceUserId) {
      const pushRes = await authFetch(`/api/employees/${savedEmployeeId}/push-to-device`, { method: 'POST' })
      const pushData = await pushRes?.json().catch(() => ({}))
      pushMessage = !pushRes?.ok
        ? (pushData?.error?.message || t('employees.devicePushFailed'))
        : pushData?.data?.devicePush?.autoAssigned
          ? t('employees.devicePushedAutoUid', { uid: pushData.data.devicePush.deviceUid })
          : t('employees.devicePushed')
    }

    setMessage('')
    reset()
    load()
    if (pushMessage) setMessage(pushMessage)
  }

  const remove = async (id) => {
    const confirmed = window.confirm(t('employees.confirmDelete'))
    if (!confirmed) return
    const res = await authFetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (!res?.ok) {
      setMessage(t('employees.couldNotDelete'))
      return
    }
    if (panel && panel.type === 'edit' && panel.employee.id === id) reset()
    load()
  }

  const startBulkEdit = () => {
    const initial = {}
    for (const emp of employees) {
      initial[emp.id] = {
        department: emp.department || '',
        ...(isAdmin ? {
          salaryType: emp.salary_type || 'hourly',
          hourlyRate: Number(emp.hourly_rate || 0),
          monthlySalary: Number(emp.monthly_salary || 0),
        } : {}),
      }
    }
    setBulkEdits(initial)
    setBulkMode(true)
    setBulkMessage('')
  }

  const cancelBulkEdit = () => {
    setBulkMode(false)
    setBulkEdits({})
    setBulkMessage('')
  }

  const updateBulkField = (id, field, value) => {
    setBulkEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const isRowDirty = (emp) => {
    const b = bulkEdits[emp.id]
    if (!b) return false
    return (
      b.department !== (emp.department || '') ||
      (isAdmin && (
        b.salaryType !== (emp.salary_type || 'hourly') ||
        Number(b.hourlyRate || 0) !== Number(emp.hourly_rate || 0) ||
        Number(b.monthlySalary || 0) !== Number(emp.monthly_salary || 0)
      ))
    )
  }

  const dirtyEmployees = employees.filter(isRowDirty)

  const saveBulkEdits = async () => {
    const targets = dirtyEmployees
    if (targets.length === 0) {
      setBulkMode(false)
      return
    }
    setBulkSaving(true)
    setBulkMessage('')

    const results = await Promise.allSettled(targets.map((emp) => {
      const b = bulkEdits[emp.id]
      return authFetch(`/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: b.department,
          ...(isAdmin ? {
            salaryType: b.salaryType,
            hourlyRate: Number(b.hourlyRate || 0),
            monthlySalary: Number(b.monthlySalary || 0),
          } : {}),
        }),
      }).then((res) => res?.ok)
    }))

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value).length
    const failed = targets.length - succeeded

    setBulkSaving(false)
    setBulkMessage(failed > 0
      ? t('employees.bulkSavedWithFailures', { succeeded, failed })
      : t('employees.bulkSaved', { count: succeeded }))
    await load()
    if (failed === 0) {
      setBulkMode(false)
      setBulkEdits({})
    }
  }

  const isOpen = panel !== null
  const title = isOpen && panel === 'add' ? t('employees.addEmployeeTitle') : isOpen && panel.type === 'edit' ? t('employees.editEmployee') : ''

  return (
    <div style={styles.page} className="fade-in">
      <PageHeader
        title={t('employees.title')}
        subtitle={t('employees.subtitle')}
        actions={bulkMode ? (
          <>
            <button className="btn btn-ghost" onClick={cancelBulkEdit}><X size={16} /> {t('employees.cancel')}</button>
            <button className="btn btn-primary" onClick={saveBulkEdits} disabled={bulkSaving}>
              <Save size={16} /> {bulkSaving ? t('employees.saving') : (dirtyEmployees.length > 0 ? t('employees.saveCount', { count: dirtyEmployees.length }) : t('employees.saveAll'))}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={startBulkEdit}><Table2 size={16} /> {t('employees.bulkEdit')}</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> {t('employees.addEmployee')}</button>
          </>
        )}
      />

      {message && !isOpen ? <div style={styles.notice}>{message}</div> : null}
      {bulkMode && (
        <div style={styles.bulkBar}>
          <span>{t('employees.bulkBarLabel', { count: dirtyEmployees.length })}</span>
          {bulkMessage && <span style={{ color: 'var(--accent)' }}>{bulkMessage}</span>}
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              {[
                t('employees.colEmployee'),
                t('employees.colDepartment'),
                ...(isAdmin ? [t('employees.colSalaryRule')] : []),
                t('employees.colCardNo'),
                t('employees.colActions'),
              ].map((item) => (
                <th key={item}>{item}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((item) => {
              const edit = bulkEdits[item.id]
              const dirty = bulkMode && isRowDirty(item)
              return (
              <tr key={item.id} style={dirty ? { background: 'var(--accent-soft)' } : undefined}>
                <td>
                  <div style={styles.strong}>{item.first_name} {item.last_name}</div>
                  <div style={styles.muted}>{item.employee_code}</div>
                </td>
                <td>
                  {bulkMode && edit ? (
                    <input
                      className="input"
                      style={styles.bulkInput}
                      placeholder={t('employees.departmentPlaceholder')}
                      value={edit.department}
                      onChange={(e) => updateBulkField(item.id, 'department', e.target.value)}
                    />
                  ) : (item.department || '-')}
                </td>
                {isAdmin && (
                  <td>
                    {bulkMode && edit ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          className="select"
                          style={styles.bulkSelect}
                          value={edit.salaryType}
                          onChange={(e) => updateBulkField(item.id, 'salaryType', e.target.value)}
                        >
                          <option value="hourly">{t('common.hourly')}</option>
                          <option value="monthly">{t('common.monthly')}</option>
                        </select>
                        <input
                          className="input"
                          style={styles.bulkInput}
                          type="number" min={0} step="0.01"
                          value={edit.salaryType === 'hourly' ? edit.hourlyRate : edit.monthlySalary}
                          onChange={(e) => updateBulkField(item.id, edit.salaryType === 'hourly' ? 'hourlyRate' : 'monthlySalary', e.target.value)}
                        />
                      </div>
                    ) : (
                      <>
                        <div style={styles.strong}>
                          {item.salary_type === 'monthly'
                            ? `${money(item.monthly_salary)} ${t('common.perMonth')}`
                            : `${money(item.hourly_rate)} ${t('common.perHour')}`}
                        </div>
                        <div style={styles.muted}>{item.salary_type === 'monthly' ? t('common.monthly') : t('common.hourly')}</div>
                      </>
                    )}
                  </td>
                )}
                <td>{item.card_number || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="icon-btn"
                      title={t('common.edit')}
                      disabled={bulkMode}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="icon-btn danger"
                      title={t('common.delete')}
                      disabled={bulkMode}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
            {employees.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4}>
                  <EmptyState icon={Users}>{t('employees.noEmployees')}</EmptyState>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={isOpen}
        onClose={reset}
        title={title}
        subtitle={panel === 'add' ? t('employees.addSubtitle') : t('employees.editSubtitle')}
        wide
        footer={
          <>
            <button type="button" onClick={reset} className="btn btn-ghost">{t('employees.cancel')}</button>
            <button type="submit" form="employee-form" className="btn btn-primary">{t('employees.saveChanges')}</button>
          </>
        }
      >
        <form id="employee-form" onSubmit={save} style={formShell}>
          <div style={grid}>
            <Field label={t('employees.firstName')} required value={form.firstName} onChange={(value) => setForm((prev) => ({ ...prev, firstName: value }))} />
            <Field label={t('employees.lastName')} value={form.lastName} onChange={(value) => setForm((prev) => ({ ...prev, lastName: value }))} />

            <Field label={t('employees.employeeCode')} required value={form.employeeCode} onChange={(value) => setForm((prev) => ({ ...prev, employeeCode: value }))} />
            <Field label={t('employees.deviceUserId')} value={form.deviceUserId} onChange={(value) => setForm((prev) => ({ ...prev, deviceUserId: value }))} />

            <Field label={t('employees.department')} value={form.department} onChange={(value) => setForm((prev) => ({ ...prev, department: value }))} />
            <Field label={t('employees.position')} value={form.position} onChange={(value) => setForm((prev) => ({ ...prev, position: value }))} />

            <Field label={t('employees.cardNumber')} value={form.cardNumber} onChange={(value) => setForm((prev) => ({ ...prev, cardNumber: value }))} />

            {isAdmin && (
              <>
                <SelectField
                  label={t('employees.salaryType')}
                  value={form.salaryType}
                  onChange={(value) => setForm((prev) => ({ ...prev, salaryType: value }))}
                  options={[
                    { value: 'hourly', label: t('common.hourly') },
                    { value: 'monthly', label: t('common.monthly') },
                  ]}
                />

                {form.salaryType === 'hourly' ? (
                  <Field label={t('employees.hourlyRate')} type="number" min={0} step="0.01" value={String(form.hourlyRate)} onChange={(value) => setForm((prev) => ({ ...prev, hourlyRate: Number(value || 0) }))} />
                ) : (
                  <Field label={t('employees.monthlySalary')} type="number" min={0} step="0.01" value={String(form.monthlySalary)} onChange={(value) => setForm((prev) => ({ ...prev, monthlySalary: Number(value || 0) }))} />
                )}

                {form.salaryType === 'hourly' ? (
                  <Field label={t('employees.monthlyHours')} type="number" min={0} step="0.5" value={String(form.standardHours)} onChange={(value) => setForm((prev) => ({ ...prev, standardHours: Number(value || 0) }))} />
                ) : (
                  <Field label={t('employees.payrollMonthHours')} type="number" min={0} step="0.5" value={String(form.standardHours)} onChange={(value) => setForm((prev) => ({ ...prev, standardHours: Number(value || 0) }))} />
                )}
              </>
            )}

            <Field label={t('employees.deviceUid')} value={String(form.deviceUid || '')} onChange={(value) => setForm((prev) => ({ ...prev, deviceUid: value }))} />
            <Field label={t('employees.deviceRole')} value={String(form.deviceRole || '')} onChange={(value) => setForm((prev) => ({ ...prev, deviceRole: value }))} />

            <SelectField
              label={t('employees.primaryDevice')}
              value={form.primaryDeviceId || ''}
              onChange={(value) => setForm((prev) => ({ ...prev, primaryDeviceId: value }))}
              options={[
                { value: '', label: t('employees.primaryDeviceUnassigned') },
                ...devices.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>

          <div style={shiftSection}>
            <h3 style={styles.sectionTitle}>{t('employees.shiftSection')}</h3>
            <p style={styles.sectionSub}>{t('employees.shiftSectionSub')}</p>
            <SegmentedControl
              options={[
                { value: 'default', label: t('employees.shiftCompanyDefault') },
                { value: 'standard', label: t('employees.shiftStandard') },
                { value: 'perDay', label: t('employees.shiftPerDay') },
              ]}
              value={shiftMode}
              onChange={setShiftMode}
            />

            {shiftMode === 'standard' && (
              <div style={styles.standardRow}>
                <Field
                  label={t('reports.shiftStart')} type="time"
                  value={shiftStandard.shiftStart}
                  onChange={(value) => setShiftStandard((s) => ({ ...s, shiftStart: value }))}
                />
                <Field
                  label={t('reports.shiftEnd')} type="time"
                  value={shiftStandard.shiftEnd}
                  onChange={(value) => setShiftStandard((s) => ({ ...s, shiftEnd: value }))}
                />
              </div>
            )}

            {shiftMode === 'perDay' && (
              <div style={styles.perDayList}>
                {shiftDays.map((day, index) => (
                  <div key={day.weekday} style={styles.perDayRow}>
                    <label style={styles.perDayToggle}>
                      <input
                        type="checkbox"
                        checked={day.isWorking}
                        onChange={(e) => updateShiftDay(index, 'isWorking', e.target.checked)}
                      />
                      {weekdayLabel(day.weekday, locale)}
                    </label>
                    <input
                      className="input" type="time" style={styles.perDayTime}
                      disabled={!day.isWorking}
                      value={day.shiftStart}
                      onChange={(e) => updateShiftDay(index, 'shiftStart', e.target.value)}
                    />
                    <input
                      className="input" type="time" style={styles.perDayTime}
                      disabled={!day.isWorking}
                      value={day.shiftEnd}
                      onChange={(e) => updateShiftDay(index, 'shiftEnd', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={shiftSection}>
            <h3 style={styles.sectionTitle}>{t('employees.leaveBalanceTitle')}</h3>
            <p style={styles.sectionSub}>{t('employees.leaveBalanceSub')}</p>
            <div style={styles.standardRow}>
              <Field
                label={t('employees.leaveBalanceAdjustmentLabel')} type="number" step="0.5"
                value={String(form.leaveBalanceAdjustment)}
                onChange={(value) => setForm((prev) => ({ ...prev, leaveBalanceAdjustment: value }))}
              />
            </div>
            {leaveBalance && (
              <div style={styles.balanceBox}>
                <span>{t('leave.balanceAccrued')}: <strong>{t('leave.balanceDays', { count: leaveBalance.accrued })}</strong></span>
                <span>{t('leave.balanceConsumed')}: <strong>{t('leave.balanceDays', { count: leaveBalance.consumed })}</strong></span>
                <span>{t('leave.balanceRemaining')}: <strong>{t('leave.balanceDays', { count: leaveBalance.remaining })}</strong></span>
              </div>
            )}
          </div>

          {message ? <div style={error}>{message}</div> : null}
        </form>
      </Modal>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', min, step, required }) {
  return (
    <label style={field}>
      <span style={labelText}>{label} {required ? <span style={{ color: 'var(--danger)' }}>*</span> : null}</span>
      <input
        className="input"
        type={type}
        min={min}
        step={step}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={field}>
      <span style={labelText}>{label}</span>
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  notice: {
    background: 'var(--danger-soft)', border: '1px solid var(--danger)',
    borderRadius: 12, padding: '10px 14px', color: 'var(--danger)', fontSize: 13,
  },
  muted: { color: 'var(--muted)', fontSize: 12, marginTop: 2 },
  strong: { fontWeight: 500, color: 'var(--text)' },
  bulkBar: {
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
    padding: '10px 14px', fontSize: 13, color: 'var(--muted)',
  },
  bulkInput: { padding: '7px 10px', fontSize: 13, minWidth: 110 },
  bulkSelect: { padding: '7px 8px', fontSize: 12, minWidth: 90 },
  sectionTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: 'var(--muted)', marginBottom: 14 },
  standardRow: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '14px 16px', marginTop: 14, maxWidth: 360 },
  perDayList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  perDayRow: { display: 'flex', alignItems: 'center', gap: 12 },
  perDayToggle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, width: 72, flexShrink: 0, textTransform: 'capitalize' },
  perDayTime: { flex: 1, maxWidth: 160 },
  balanceBox: {
    display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)',
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px',
    marginTop: 14,
  },
}

const field = { display: 'flex', flexDirection: 'column', gap: 6 }
const labelText = { fontSize: 12, color: 'var(--muted)' }
const formShell = { display: 'flex', flexDirection: 'column', gap: 14 }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px 16px' }
const error = { color: 'var(--danger)', fontSize: 13 }
const shiftSection = { borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 4 }
