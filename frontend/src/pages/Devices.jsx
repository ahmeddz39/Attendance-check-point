import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { Plus, Radar, PlugZap, RefreshCw, Trash2, Users, Router } from 'lucide-react'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { SkeletonBlock } from '../components/Skeleton'
import { formatDateTime } from '../i18n/formatDate'

const emptyForm = {
  name: '', brand: 'ZKTeco', model: 'K40', ipAddress: '', port: 4370, protocol: 'zkteco', location: '',
  httpBaseUrl: '', httpAuthType: 'none', httpUsername: '', httpPassword: '', httpToken: '', httpAdvancedJson: '',
}

const PROTOCOLS = [
  { value: 'zkteco', labelKey: 'devices.protocolZkteco' },
  { value: 'http-generic', labelKey: 'devices.protocolHttpGeneric' },
]
const HTTP_AUTH_TYPES = ['none', 'basic', 'digest', 'bearer']

const STATUS_TONE = { online: 'accent', offline: 'danger' }

export default function Devices() {
  const { t, i18n } = useTranslation()
  const { authFetch } = useAuth()
  const [devices, setDevices] = useState([])
  const [discovered, setDiscovered] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [importingDeviceId, setImportingDeviceId] = useState(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importDone, setImportDone] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
  const [scanState, setScanState] = useState('idle') // idle | scanning | results
  const [scanMessage, setScanMessage] = useState('')
  const [connectState, setConnectState] = useState(null) // null | 'connecting' | { ok, name }

  const load = async () => {
    const res = await authFetch('/api/devices').catch(() => null)
    const data = res?.ok && await res.json().catch(() => ({}))
    setDevices(Array.isArray(data?.data) ? data.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [authFetch])

  const resetForm = () => setForm(emptyForm)
  const closeAdd = () => { setShowAdd(false); resetForm() }
  const closeDiscover = () => {
    setShowDiscover(false)
    setDiscovered([])
    setScanState('idle')
    setScanMessage('')
    setConnectState(null)
  }
  const closeImport = () => { setImportingDeviceId(null); setImportProgress(0); setImportDone(false) }

  const startImport = async (id, type) => {
    setImportingDeviceId(id)
    setImportProgress(0)
    setImportDone(false)
    const res = await authFetch(`/api/devices/${id}/${type}`, { method: 'POST' })
    const data = res?.ok && await res.json().catch(() => ({}))
    setImportProgress(100)
    if (!res?.ok) {
      setMessage(data?.error?.message || t('devices.importFailed'))
      setImportDone(true)
      return
    }
    const count = data?.data?.imported ?? 0
    setMessage(type === 'sync-users' ? t('devices.importedEmployees', { count }) : t('devices.importedLogs', { count }))
    setImportDone(true)
    load()
  }

  const save = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      let settings
      if (form.protocol === 'http-generic') {
        let advanced = {}
        if (form.httpAdvancedJson.trim()) {
          try {
            advanced = JSON.parse(form.httpAdvancedJson)
          } catch {
            throw new Error(t('devices.invalidAdvancedJson'))
          }
        }
        settings = {
          baseUrl: form.httpBaseUrl || undefined,
          authType: form.httpAuthType,
          ...(form.httpAuthType === 'bearer'
            ? { token: form.httpToken || undefined }
            : { username: form.httpUsername || undefined, password: form.httpPassword || undefined }),
          ...advanced,
        }
      }

      const res = await authFetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          brand: form.brand,
          model: form.model,
          ipAddress: form.ipAddress,
          port: Number(form.port),
          protocol: form.protocol,
          location: form.location,
          ...(settings ? { settings } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res?.ok) throw new Error(data?.error?.message || t('devices.couldNotSave'))
      setMessage('')
      closeAdd()
      load()
    } catch (error) {
      setMessage(error.message || t('devices.couldNotSave'))
    }
  }

  const discover = async () => {
    setScanState('scanning')
    setScanMessage(t('devices.scanning'))
    setDiscovered([])
    const res = await authFetch('/api/devices/discover')
    const data = await res?.json().catch(() => ({}))
    const list = Array.isArray(data?.data) ? data.data : []
    setDiscovered(list)
    setScanMessage(list.length ? t('devices.foundCandidates', { count: list.length }) : t('devices.noneAnswered'))
    setScanState('results')
  }

  const selectDiscovered = async (d) => {
    const port = d.port || 4370
    const name = `ZKTeco ${d.ipAddress}`
    setConnectState('connecting')

    // A discovered IP:port may already be a registered device -- test its
    // connection directly instead of trying (and failing, on the ip/port
    // unique constraint) to insert a duplicate row. Postgres' INET type
    // renders a host address back as text with a "/32" suffix, so strip it
    // before comparing to the plain dotted-quad the discovery scan returns.
    const existing = devices.find((dev) => dev.ip_address?.split('/')[0] === d.ipAddress && dev.port === port)

    let deviceId = existing?.id
    if (!deviceId) {
      const createRes = await authFetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          brand: d.brand || 'standard',
          ipAddress: d.ipAddress,
          port,
          protocol: d.protocol || 'zkteco',
        }),
      })
      const createData = await createRes?.json().catch(() => ({}))
      if (!createRes?.ok) {
        setConnectState({ stage: 'error', name, error: createData?.error?.message || t('devices.couldNotSave') })
        return
      }
      deviceId = createData?.data?.id
    }

    const connectRes = await authFetch(`/api/devices/${deviceId}/connect`, { method: 'POST' })
    const connectData = await connectRes?.json().catch(() => ({}))
    setConnectState({
      stage: 'connected',
      ok: !!connectData?.data?.online,
      name: existing?.name || name,
      wasExisting: !!existing,
    })
    load()
  }

  const connect = async (id) => {
    const res = await authFetch(`/api/devices/${id}/connect`, { method: 'POST' })
    const data = await res?.json().catch(() => ({}))
    setMessage(data?.data?.online ? t('devices.reachable') : t('devices.notReachable'))
    load()
  }

  const remove = async (id) => {
    if (!confirm(t('devices.confirmDelete'))) return
    await authFetch(`/api/devices/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={styles.page} className="fade-in">
      <PageHeader
        title={t('devices.title')}
        subtitle={t('devices.subtitle')}
        actions={<>
          <button className="btn btn-ghost" onClick={() => setShowDiscover(true)}><Radar size={15} /> {t('devices.discover')}</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> {t('devices.addDevice')}</button>
        </>}
      />

      {message && <div className="card" style={styles.notice}>{message}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {loading ? <div style={{ padding: 20 }}><SkeletonBlock height={160} /></div> : devices.length === 0 ? (
          <EmptyState icon={Router}>{t('devices.noDevices')}</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>{[t('devices.colDevice'), t('devices.colNetwork'), t('devices.colStatus'), t('devices.colLastSeen'), t('devices.colActions')].map((h) => (<th key={h}>{h}</th>))}</tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const importing = importingDeviceId === d.id
                return (
                  <tr key={d.id}>
                    <td><b>{d.name}</b><div style={styles.muted}>{d.brand} {d.model}</div></td>
                    <td>{d.ip_address}:{d.port}</td>
                    <td><Badge tone={STATUS_TONE[d.status] || 'muted'}>{t(`devices.statusValue.${d.status}`, d.status)}</Badge></td>
                    <td>{d.last_seen_at ? formatDateTime(d.last_seen_at, i18n.language) : t('devices.never')}</td>
                    <td>
                      <div style={styles.actions}>
                        <button disabled={importing} className="btn btn-ghost" style={{...styles.actionBtn, opacity: importing ? 0.6 : 1}} onClick={() => connect(d.id)} title={t('devices.connect')}><PlugZap size={14} /> {t('devices.connect')}</button>
                        <button disabled={importing} className="btn btn-ghost" style={{...styles.actionBtn, opacity: importing ? 0.6 : 1}} onClick={() => startImport(d.id, 'sync-users')} title={t('devices.importEmployees')}><Users size={14} /> {t('devices.importEmployees')}</button>
                        <button disabled={importing} className="btn btn-ghost" style={{...styles.actionBtn, opacity: importing ? 0.6 : 1}} onClick={() => startImport(d.id, 'sync-logs')} title={t('devices.importLogs')}><RefreshCw size={14} /> {t('devices.importLogs')}</button>
                        <button className="icon-btn danger" onClick={() => remove(d.id)} title={t('devices.delete')}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={showAdd}
        onClose={closeAdd}
        title={t('devices.addDeviceTitle')}
        subtitle={t('devices.completeFields')}
        footer={
          <>
            <button type="button" onClick={closeAdd} className="btn btn-ghost">{t('devices.cancel')}</button>
            <button type="submit" form="device-form" className="btn btn-primary">{t('devices.saveDevice')}</button>
          </>
        }
      >
        <form id="device-form" onSubmit={save} style={styles.formGrid}>
          <select className="input" value={form.protocol} onChange={e => setForm(prev => ({ ...prev, protocol: e.target.value }))}>
            {PROTOCOLS.map((p) => (<option key={p.value} value={p.value}>{t(p.labelKey)}</option>))}
          </select>
          <input className="input" placeholder={t('devices.namePlaceholder')} required value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
          <input className="input" placeholder={t('devices.brandPlaceholder')} value={form.brand} onChange={e => setForm(prev => ({ ...prev, brand: e.target.value }))} />
          <input className="input" placeholder={t('devices.modelPlaceholder')} value={form.model} onChange={e => setForm(prev => ({ ...prev, model: e.target.value }))} />
          <input className="input" placeholder={t('devices.ipPlaceholder')} required value={form.ipAddress} onChange={e => setForm(prev => ({ ...prev, ipAddress: e.target.value }))} />
          <input className="input" type="number" placeholder={t('devices.portPlaceholder')} value={form.port} onChange={e => setForm(prev => ({ ...prev, port: e.target.value }))} />
          <input className="input" placeholder={t('devices.locationPlaceholder')} value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} />

          {form.protocol === 'http-generic' && (
            <div style={styles.httpFields}>
              <div style={styles.httpFieldsTitle}>{t('devices.httpSectionTitle')}</div>
              <input className="input" placeholder={t('devices.httpBaseUrlPlaceholder')} value={form.httpBaseUrl} onChange={e => setForm(prev => ({ ...prev, httpBaseUrl: e.target.value }))} />
              <select className="input" value={form.httpAuthType} onChange={e => setForm(prev => ({ ...prev, httpAuthType: e.target.value }))}>
                {HTTP_AUTH_TYPES.map((a) => (<option key={a} value={a}>{t(`devices.authType.${a}`)}</option>))}
              </select>
              {form.httpAuthType === 'bearer' ? (
                <input className="input" placeholder={t('devices.httpTokenPlaceholder')} value={form.httpToken} onChange={e => setForm(prev => ({ ...prev, httpToken: e.target.value }))} />
              ) : form.httpAuthType !== 'none' && (
                <>
                  <input className="input" placeholder={t('devices.httpUsernamePlaceholder')} value={form.httpUsername} onChange={e => setForm(prev => ({ ...prev, httpUsername: e.target.value }))} />
                  <input className="input" type="password" placeholder={t('devices.httpPasswordPlaceholder')} value={form.httpPassword} onChange={e => setForm(prev => ({ ...prev, httpPassword: e.target.value }))} />
                </>
              )}
              <textarea className="input" rows={3} placeholder={t('devices.httpAdvancedPlaceholder')} value={form.httpAdvancedJson} onChange={e => setForm(prev => ({ ...prev, httpAdvancedJson: e.target.value }))} />
              <div style={styles.httpHint}>{t('devices.httpAdvancedHint')}</div>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={showDiscover}
        onClose={closeDiscover}
        title={t('devices.discoverTitle')}
        subtitle={t('devices.discoverSubtitle')}
        footer={connectState && connectState !== 'connecting' ? (
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={closeDiscover}>{t('devices.done')}</button>
        ) : null}
      >
        <div style={styles.discoverBody}>
          {!connectState && (
            <>
              <button
                type="button"
                onClick={discover}
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={scanState === 'scanning'}
              >
                {t('devices.startScan')}
              </button>
              {scanMessage && <div style={styles.scanMessage}>{scanMessage}</div>}
              {scanState === 'results' && discovered.length > 0 && (
                <div style={styles.scanHint}>{t('devices.selectHint')}</div>
              )}
              {discovered.map((d, idx) => (
                <button
                  key={`${d.ipAddress || 'unknown'}:${d.port || 4370}-${idx}`}
                  type="button"
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => selectDiscovered(d)}
                >
                  {d.ipAddress || 'unknown'}:{d.port || 4370}
                </button>
              ))}
            </>
          )}

          {connectState === 'connecting' && (
            <div style={styles.progressLabel}>{t('devices.connectingEllipsis')}</div>
          )}

          {connectState?.stage === 'error' && (
            <div style={styles.scanMessage}>{connectState.error}</div>
          )}

          {connectState?.stage === 'connected' && (
            <div style={styles.scanMessage}>
              {connectState.wasExisting
                ? (connectState.ok
                    ? t('devices.alreadyRegisteredReachable', { name: connectState.name })
                    : t('devices.alreadyRegisteredUnreachable', { name: connectState.name }))
                : (connectState.ok
                    ? t('devices.addedAndConnected', { name: connectState.name })
                    : t('devices.addedButUnreachable', { name: connectState.name }))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!importingDeviceId}
        onClose={closeImport}
        title={t('devices.importingLogsTitle')}
        footer={importDone ? <button className="btn btn-primary" style={{ width: '100%' }} onClick={closeImport}>{t('devices.done')}</button> : null}
      >
        <div style={styles.track}>
          <div style={{ ...styles.bar, width: `${importProgress}%` }} />
        </div>
        <div style={styles.progressLabel}>{importDone ? t('devices.doneExclaim') : t('devices.importingEllipsis')}</div>
      </Modal>
    </div>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  notice: { padding: '10px 14px', color: 'var(--muted)', fontSize: 13 },
  muted: { color: 'var(--muted)', fontSize: 12 },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  actionBtn: { height: 32, padding: '0 11px', fontSize: 12, fontWeight: 500 },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  httpFields: { display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, background: 'var(--bg3)' },
  httpFieldsTitle: { fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 },
  httpHint: { fontSize: 11, color: 'var(--muted)' },
  discoverBody: { display: 'flex', flexDirection: 'column', gap: 10 },
  scanMessage: { fontSize: 13, color: 'var(--muted)', fontWeight: 500 },
  scanHint: { fontSize: 12, color: 'var(--muted)' },
  track: { height: 10, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' },
  bar: { height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent2))', transition: 'width 240ms ease' },
  progressLabel: { fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginTop: 10 },
}
