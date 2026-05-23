import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { UserPlus, Shield, Eye, BarChart2 } from 'lucide-react'

const ROLE_ICON = { admin: Shield, analyst: BarChart2, viewer: Eye }
const ROLE_COLOR = { admin: 'var(--accent)', analyst: 'var(--accent2)', viewer: 'var(--warn)' }

export default function Users() {
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
    ]).then(([u, s]) => {
      if (!u?.success) {
        setError(u?.error?.message || 'Failed to load users')
        setUsers([])
      } else {
        setUsers(u?.data || [])
      }
      setRoles([{id:1,name:'admin'},{id:2,name:'analyst'},{id:3,name:'viewer'}])
    }).catch(err => {
      setError('Failed to load users')
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
    if (!res?.ok) { setError(data?.error?.message || 'Failed'); setSaving(false); return }
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
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Users</h1>
          <p style={styles.sub}>{users.length} total accounts</p>
        </div>
        {me?.role === 'admin' && (
          <button style={styles.btn} onClick={() => setShowForm(v => !v)}>
            <UserPlus size={15} /> Add User
          </button>
        )}
      </div>

      {/* Add user form */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={{fontSize:14, fontWeight:600, marginBottom:16}}>New User</h3>
          <form onSubmit={submit} style={styles.formGrid}>
            <input style={styles.input} placeholder="First name" required value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} />
            <input style={styles.input} placeholder="Last name"  value={form.lastName}  onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} />
            <input style={{...styles.input, gridColumn:'span 2'}} placeholder="Email" type="email" required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
            <input style={{...styles.input, gridColumn:'span 2'}} placeholder="Password (min 8 chars)" type="password" required minLength={8} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} />
            <select style={{...styles.input, gridColumn:'span 2'}} required value={form.roleId} onChange={e=>setForm(f=>({...f,roleId:parseInt(e.target.value)}))}>
              <option value="">Select role…</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {error && <div style={{...styles.errorMsg, gridColumn:'span 2'}}>{error}</div>}
            <div style={{display:'flex', gap:8, gridColumn:'span 2'}}>
              <button type="submit" style={styles.btn} disabled={saving}>{saving?'Creating…':'Create User'}</button>
              <button type="button" style={styles.btnGhost} onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div style={styles.tableCard}>
        {loading ? <p style={{color:'var(--muted)', padding:20}}>Loading…</p> : (
          <table style={styles.table}>
            <thead><tr>
              {['User','Role','Status','Last Login', me?.role==='admin'?'Actions':''].filter(Boolean).map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map(u => {
                const Icon = ROLE_ICON[u.role] || Eye
                const color = ROLE_COLOR[u.role]
                return (
                  <tr key={u.id}>
                    <td style={styles.td}>
                      <div style={styles.userCell}>
                        <div style={{...styles.avatar, background: color+'22', color}}>
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                        <div>
                          <div style={{fontWeight:500}}>{u.first_name} {u.last_name}</div>
                          <div style={{fontSize:12, color:'var(--muted)'}}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{display:'flex', alignItems:'center', gap:5, color}}>
                        <Icon size={13} /><span style={{fontSize:12, fontFamily:'var(--mono)'}}>{u.role}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{...styles.badge, ...(u.is_active ? styles.badgeGreen : styles.badgeRed)}}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{...styles.td, color:'var(--muted)', fontSize:12, fontFamily:'var(--mono)'}}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    {me?.role === 'admin' && (
                      <td style={styles.td}>
                        {u.id !== me.id && (
                          <button style={{...styles.btnTiny, color: u.is_active ? 'var(--danger)' : 'var(--accent)'}}
                            onClick={() => toggleActive(u.id, u.is_active)}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
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
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  h1: { fontSize:24, fontWeight:600, letterSpacing:'-0.5px' },
  sub: { color:'var(--muted)', fontSize:14, marginTop:4 },
  btn: { display:'flex', alignItems:'center', gap:7, background:'linear-gradient(135deg, var(--accent), var(--accent2))', border:'none', borderRadius:8, padding:'9px 16px', color:'#0d0f12', fontWeight:600, fontSize:13 },
  btnGhost: { display:'flex', alignItems:'center', gap:7, background:'transparent', border:'1px solid var(--border)', borderRadius:8, padding:'9px 16px', color:'var(--muted)', fontSize:13 },
  btnTiny: { background:'none', border:'none', fontSize:12, fontWeight:600, cursor:'pointer', padding:'4px 8px', borderRadius:6 },
  formCard: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'20px 24px' },
  formGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  input: { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', color:'var(--text)', fontSize:13, outline:'none' },
  errorMsg: { background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:8, padding:'8px 12px', color:'var(--danger)', fontSize:13 },
  tableCard: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', fontSize:11, color:'var(--muted)', padding:'12px 16px', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid var(--border)', background:'var(--bg3)' },
  td: { padding:'12px 16px', fontSize:13, borderBottom:'1px solid rgba(255,255,255,0.03)' },
  userCell: { display:'flex', alignItems:'center', gap:10 },
  avatar: { width:34, height:34, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 },
  badge: { fontSize:11, padding:'3px 9px', borderRadius:20, fontFamily:'var(--mono)', fontWeight:600 },
  badgeGreen: { background:'rgba(74,222,128,0.1)', color:'var(--accent)' },
  badgeRed:   { background:'rgba(248,113,113,0.1)', color:'var(--danger)' },
}
