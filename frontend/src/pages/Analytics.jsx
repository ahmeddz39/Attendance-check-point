import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

const METRICS   = ['active_users', 'revenue', 'signups']
const INTERVALS = ['day', 'week', 'month']
const COLORS    = { active_users: '#4ade80', revenue: '#22d3ee', signups: '#fbbf24' }

export default function Analytics() {
  const { authFetch } = useAuth()
  const [data, setData]         = useState([])
  const [metric, setMetric]     = useState('active_users')
  const [interval, setInterval] = useState('day')
  const [chartType, setChartType] = useState('line')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    setLoading(true)
    authFetch(`/api/analytics/metrics?name=${metric}&interval=${interval}`)
      .then(r => r?.json())
      .then(d => {
        const rows = (d?.data || []).map(r => ({
          date: new Date(r.period).toLocaleDateString('en', {
            month: 'short', day: interval === 'month' ? undefined : 'numeric'
          }),
          value: Math.round(parseFloat(r.average)),
          total: Math.round(parseFloat(r.total)),
        }))
        setData(rows)
      })
      .catch(err => {
        console.error('Analytics load error:', err)
        setData([])
      })
      .finally(() => setLoading(false))
  }, [metric, interval, authFetch])

  const color = COLORS[metric] || '#4ade80'

  return (
    <div style={styles.page} className="fade-in">
      <div style={styles.header}>
        <h1 style={styles.h1}>Analytics</h1>
        <div style={styles.controls}>
          {/* Metric picker */}
          <div style={styles.btnGroup}>
            {METRICS.map(m => (
              <button key={m} onClick={() => setMetric(m)}
                style={{...styles.pill, ...(metric===m ? styles.pillActive : {})}}>
                {m.replace(/_/g,' ')}
              </button>
            ))}
          </div>
          {/* Interval */}
          <div style={styles.btnGroup}>
            {INTERVALS.map(i => (
              <button key={i} onClick={() => setInterval(i)}
                style={{...styles.pill, ...(interval===i ? styles.pillActive : {})}}>
                {i}
              </button>
            ))}
          </div>
          {/* Chart type */}
          <div style={styles.btnGroup}>
            {['line','bar'].map(t => (
              <button key={t} onClick={() => setChartType(t)}
                style={{...styles.pill, ...(chartType===t ? styles.pillActive : {})}}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={{fontSize:14, fontWeight:600, textTransform:'capitalize'}}>
            {metric.replace(/_/g,' ')} — by {interval}
          </span>
          {loading && <span style={{fontSize:12, color:'var(--muted)'}}>Loading…</span>}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          {chartType === 'line' ? (
            <LineChart data={data} margin={{ top:10, right:10, left:-20, bottom:0 }}>
              <CartesianGrid stroke="#1e2430" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill:'#6b7280', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#6b7280', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'#13161b', border:'1px solid #252a35', borderRadius:8, fontSize:13 }}
                labelStyle={{ color:'#e8eaf0' }} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} name="Average" />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top:10, right:10, left:-20, bottom:0 }}>
              <CartesianGrid stroke="#1e2430" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill:'#6b7280', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#6b7280', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'#13161b', border:'1px solid #252a35', borderRadius:8, fontSize:13 }}
                labelStyle={{ color:'#e8eaf0' }} />
              <Bar dataKey="value" fill={color} radius={[4,4,0,0]} name="Average" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Data table */}
      <div style={styles.card}>
        <div style={styles.cardHeader}><span style={{fontSize:14, fontWeight:600}}>Raw Data</span></div>
        <div style={{overflowX:'auto'}}>
          <table style={styles.table}>
            <thead><tr>
              {['Period','Average','Total'].map(h => <th key={h} style={styles.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td style={styles.td}>{row.date}</td>
                  <td style={{...styles.td, fontFamily:'var(--mono)', color}}>{row.value.toLocaleString()}</td>
                  <td style={{...styles.td, fontFamily:'var(--mono)', color:'var(--muted)'}}>{row.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { display:'flex', flexDirection:'column', gap:24 },
  header: { display:'flex', flexDirection:'column', gap:16 },
  h1: { fontSize:24, fontWeight:600, letterSpacing:'-0.5px' },
  controls: { display:'flex', flexWrap:'wrap', gap:10 },
  btnGroup: { display:'flex', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:3, gap:2 },
  pill: { padding:'5px 12px', borderRadius:6, border:'none', background:'transparent', color:'var(--muted)', fontSize:12, fontWeight:500, transition:'all 0.15s' },
  pillActive: { background:'var(--bg3)', color:'var(--text)' },
  card: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'20px 24px' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', fontSize:11, color:'var(--muted)', padding:'8px 12px', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid var(--border)' },
  td: { padding:'10px 12px', fontSize:13, borderBottom:'1px solid rgba(255,255,255,0.03)' },
}
