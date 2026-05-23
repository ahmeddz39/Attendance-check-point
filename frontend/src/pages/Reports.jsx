import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, FileText, Globe, Lock, Trash2 } from 'lucide-react'

export default function Reports() {
  const { authFetch, user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', description:'', isPublic: false })
  const [saving, setSaving] = useState(false)

  const canWrite = ['admin','analyst'].includes(user?.role)

  const load = () => {
    authFetch('/api/reports')
      .then(r => r?.json())
      .then(d => setReports(d?.data || []))
      .catch(err => {
        console.error('Reports load error:', err)
        setReports([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { 
    load() 
  }, [authFetch])

  const submit = async (e) => {
    e.preventDefault(); setSaving(true)
    await authFetch('/api/reports', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...form, queryConfig:{} })
    })
    setForm({ name:'', description:'', isPublic:false }); setShowForm(false); load(); setSaving(false)
  }

  const remove = async (id) => {
    if (!confirm('Delete this report?')) return
    await authFetch(`/api/reports/${id}`, { method:'DELETE' })
    setReports(r => r.filter(x => x.id !== id))
  }

  return (
    <div style={styles.page} className="fade-in">
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Reports</h1>
          <p style={styles.sub}>{reports.length} saved report{reports.length !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <button style={styles.btn} onClick={() => setShowForm(v => !v)}>
            <Plus size={15} /> New Report
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={{fontSize:14, fontWeight:600, marginBottom:16}}>New Report</h3>
          <form onSubmit={submit} style={styles.form}>
            <input style={styles.input} placeholder="Report name" required
              value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
            <input style={styles.input} placeholder="Description (optional)"
              value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} />
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={form.isPublic}
                onChange={e => setForm(f => ({...f, isPublic:e.target.checked}))} />
              Make public (visible to all roles)
            </label>
            <div style={{display:'flex', gap:8}}>
              <button type="submit" style={styles.btn} disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
              <button type="button" style={styles.btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Reports grid */}
      {loading ? (
        <p style={{color:'var(--muted)'}}>Loading…</p>
      ) : reports.length === 0 ? (
        <div style={styles.empty}><FileText size={32} color="var(--muted)" /><p>No reports yet</p></div>
      ) : (
        <div style={styles.grid}>
          {reports.map(r => (
            <div key={r.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.iconWrap}><FileText size={16} color="var(--accent)" /></div>
                <div style={styles.visibility}>
                  {r.is_public
                    ? <><Globe size={11} /><span>Public</span></>
                    : <><Lock size={11} /><span>Private</span></>}
                </div>
              </div>
              <div style={styles.cardName}>{r.name}</div>
              {r.description && <div style={styles.cardDesc}>{r.description}</div>}
              <div style={styles.cardMeta}>
                Created {new Date(r.created_at).toLocaleDateString()}
                {canWrite && (
                  <button style={styles.deleteBtn} onClick={() => remove(r.id)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { display:'flex', flexDirection:'column', gap:24 },
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  h1: { fontSize:24, fontWeight:600, letterSpacing:'-0.5px' },
  sub: { color:'var(--muted)', fontSize:14, marginTop:4 },
  btn: {
    display:'flex', alignItems:'center', gap:7,
    background:'linear-gradient(135deg, var(--accent), var(--accent2))',
    border:'none', borderRadius:8, padding:'9px 16px',
    color:'#0d0f12', fontWeight:600, fontSize:13,
  },
  btnGhost: {
    display:'flex', alignItems:'center', gap:7,
    background:'transparent', border:'1px solid var(--border)',
    borderRadius:8, padding:'9px 16px', color:'var(--muted)', fontSize:13,
  },
  formCard: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'20px 24px' },
  form: { display:'flex', flexDirection:'column', gap:12 },
  input: { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', color:'var(--text)', fontSize:14, outline:'none' },
  checkLabel: { display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--muted)', cursor:'pointer' },
  empty: { display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:60, color:'var(--muted)', fontSize:14 },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 },
  card: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'18px 20px', display:'flex', flexDirection:'column', gap:8 },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  iconWrap: { width:32, height:32, borderRadius:8, background:'rgba(74,222,128,0.1)', display:'flex', alignItems:'center', justifyContent:'center' },
  visibility: { display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--muted)', fontFamily:'var(--mono)' },
  cardName: { fontSize:15, fontWeight:600, marginTop:4 },
  cardDesc: { fontSize:13, color:'var(--muted)', lineHeight:1.5 },
  cardMeta: { fontSize:11, color:'var(--muted)', marginTop:4, display:'flex', justifyContent:'space-between', alignItems:'center' },
  deleteBtn: { background:'none', border:'none', color:'var(--danger)', cursor:'pointer', padding:4, display:'flex', alignItems:'center' },
}
