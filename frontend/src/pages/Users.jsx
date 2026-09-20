import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { UserPlus, Shield, Eye, BarChart2 } from 'lucide-react'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import { SkeletonBlock } from '../components/Skeleton'
import { formatDate } from '../i18n/formatDate'

const ROLE_ICON = { admin: Shield, analyst: BarChart2, viewer: Eye }
const ROLE_TONE = { admin: 'accent', analyst: 'accent2', viewer: 'warn' }

export default function Users() {
  const { t, i18n } = useTranslation()
  const { authFetch, user: me } = useAuth()
  const [users, setUsers]     = useState([])
  const [roles, setRoles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState({ email:'', password:'', firstName:'', lastName:'', roleId:'' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const load = () => {
    setError('')
    Promise.all([
      authFetch('/api/users').then(r => r?.json()),
      authFetch('/api/analytics/summary').then(r => r?.json()), // roles not exposed separately, use hardcoded
    ]).then(([u]) => {
      if (!u?.success) {
        setError(u?.error?.message || t('users.loadFailed'))
        setUsers([])
      } else {
        setUsers(u?.data || [])
      }
      setRoles([{id:1,name:'admin'},{id:2,name:'analyst'},{id:3,name:'viewer'}])
    }).catch(err => {
      setError(t('users.loadFailed'))
      console.error('Load error:', err)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [authFetch])

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    const res = await authFetch('/api/users', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form)
    })
    const data = await res?.json()
    if (!res?.ok) { setError(data?.error?.message || t('users.createFailed')); setSaving(false); return }
    setForm({ email:'', password:'', firstName:'', lastName:'', roleId:'' })
    setShowForm(false); load(); setSaving(false)
  }

  const toggleActive = async (id, current) => {
    await authFetch(`/api/users/${id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ isActive: !current })
    })
    load()
  }

  return (
    <div style={styles.page} className="fade-in">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.totalAccounts', { count: users.length })}
        actions={me?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            <UserPlus size={15} /> {t('users.addUser')}
          </button>
        )}
      />

      {/* Add user form */}
      {showForm && (
        <div className="card fade-in" style={styles.formCard}>
          <h3 style={{fontSize:14, fontWeight:600, marginBottom:16}}>{t('users.newUser')}</h3>
          <form onSubmit={submit} style={styles.formGrid}>
            <input className="input" placeholder={t('users.firstName')} required value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} />
            <input className="input" placeholder={t('users.lastName')}  value={form.lastName}  onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} />
            <input className="input" style={{gridColumn:'span 2'}} placeholder={t('users.email')} type="email" required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
            <input className="input" style={{gridColumn:'span 2'}} placeholder={t('users.passwordMin')} type="password" required minLength={8} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} />
            <select className="select" style={{gridColumn:'span 2'}} required value={form.roleId} onChange={e=>setForm(f=>({...f,roleId:parseInt(e.target.value)}))}>
              <option value="">{t('users.selectRole')}</option>
              {roles.map(r => <option key={r.id} value={r.id}>{t(`common.roles.${r.name}`, r.name)}</option>)}
            </select>
            {error && <div style={{...styles.errorMsg, gridColumn:'span 2'}}>{error}</div>}
            <div style={{display:'flex', gap:8, gridColumn:'span 2'}}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving? t('users.creating') : t('users.createUser')}</button>
              <button type="button" className="btn btn-ghost" onClick={()=>setShowForm(false)}>{t('users.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 20 }}><SkeletonBlock height={160} /></div> : (
          <table className="table">
            <thead><tr>
              {[t('users.colUser'), t('users.colRole'), t('users.colStatus'), t('users.colLastLogin'), me?.role==='admin'? t('users.colActions') :''].filter(Boolean).map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map(u => {
                const Icon = ROLE_ICON[u.role] || Eye
                const tone = ROLE_TONE[u.role] || 'muted'
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={styles.userCell}>
                        <div style={{...styles.avatar, background: `var(--${tone}-soft)`}}>
                          <span style={{color: `var(--${tone})`}}>{u.first_name?.[0]}{u.last_name?.[0]}</span>
                        </div>
                        <div>
                          <div style={{fontWeight:500}}>{u.first_name} {u.last_name}</div>
                          <div style={{fontSize:12, color:'var(--muted)'}}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{display:'flex', alignItems:'center', gap:5, color:`var(--${tone})`}}>
                        <Icon size={13} /><span style={{fontSize:12, fontFamily:'var(--mono)'}}>{t(`common.roles.${u.role}`, u.role)}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={u.is_active ? 'accent' : 'danger'}>{u.is_active ? t('users.active') : t('users.inactive')}</Badge>
                    </td>
                    <td style={{color:'var(--muted)', fontSize:12, fontFamily:'var(--mono)'}}>
                      {u.last_login_at ? formatDate(u.last_login_at, i18n.language) : t('users.never')}
                    </td>
                    {me?.role === 'admin' && (
                      <td>
                        {u.id !== me.id && (
                          <button className="btn" style={{...styles.btnTiny, color: u.is_active ? 'var(--danger)' : 'var(--accent)'}}
                            onClick={() => toggleActive(u.id, u.is_active)}>
                            {u.is_active ? t('users.deactivate') : t('users.activate')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { display:'flex', flexDirection:'column', gap:24 },
  formCard: { padding:'20px 24px' },
  formGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  errorMsg: { background:'var(--danger-soft)', border:'1px solid var(--danger)', borderRadius:8, padding:'8px 12px', color:'var(--danger)', fontSize:13 },
  userCell: { display:'flex', alignItems:'center', gap:10 },
  avatar: { width:34, height:34, borderRadius:8, padding:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 },
  btnTiny: { background:'transparent', border:'1px solid var(--border)', fontSize:12, fontWeight:600, padding:'6px 10px' },
}
