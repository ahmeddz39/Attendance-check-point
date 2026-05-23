import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import StatCard from '../components/StatCard'
import { Users, TrendingUp, Activity, FileText } from 'lucide-react'

const fmt = (n) => n >= 1000 ? (n/1000).toFixed(1)+'k' : String(Math.round(n))
const fmtCurrency = (n) => '$' + fmt(n)

export default function Dashboard() {
  const { authFetch, user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      authFetch('/api/analytics/summary').then(r => r?.json()),
      authFetch('/api/analytics/metrics?name=active_users&interval=day').then(r => r?.json()),
    ]).then(([s, m]) => {
      setSummary(s?.data)
      // Format chart data
      const rows = (m?.data || []).map(d => ({
        date: new Date(d.period).toLocaleDateString('en', { month:'short', day:'numeric' }),
        users: Math.round(d.average),
      }))
      setMetrics(rows)
    }).catch(err => console.error('Dashboard load error:', err))
      .finally(() => setLoading(false))
  }, [authFetch])

  const activeUsers = summary?.metrics?.find(m => m.name === 'active_users')
  const revenue     = summary?.metrics?.find(m => m.name === 'revenue')
  const signups     = summary?.metrics?.find(m => m.name === 'signups')

  if (loading) return <div style={styles.loading}>Loading dashboard…</div>

  return (
    <div style={styles.page} className="fade-in">
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Good {greeting()}, {user?.firstName} 👋</h1>
          <p style={styles.sub}>Here's what's happening in the last 30 days.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={styles.grid4}>
        <StatCard label="Active Users"  value={fmt(activeUsers?.total  || 0)} sub="last 30 days" icon={Users}     accent="var(--accent)" />
        <StatCard label="Revenue"       value={fmtCurrency(revenue?.total || 0)} sub="last 30 days" icon={TrendingUp} accent="var(--accent2)" />
        <StatCard label="New Signups"   value={fmt(signups?.total || 0)}  sub="last 30 days" icon={Activity}   accent="var(--warn)" />
        <StatCard label="System Users"  value={summary?.users?.active_users || '—'} sub={`${summary?.users?.new_users || 0} new`} icon={FileText} accent="var(--muted)" />
      </div>

      {/* Chart */}
      <div style={styles.chartCard}>
        <div style={styles.chartHeader}>
          <span style={styles.chartTitle}>Daily Active Users</span>
          <span style={styles.chartBadge}>30d</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e2430" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#13161b', border: '1px solid #252a35', borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: '#e8eaf0' }} itemStyle={{ color: '#4ade80' }}
            />
            <Area type="monotone" dataKey="users" stroke="#4ade80" strokeWidth={2} fill="url(#ug)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top metrics table */}
      <div style={styles.chartCard}>
        <div style={styles.chartHeader}>
          <span style={styles.chartTitle}>Metric Summary</span>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>{['Metric','Total','Average','Data Points'].map(h => (
              <th key={h} style={styles.th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {(summary?.metrics || []).map((m, i) => (
              <tr key={m.name} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td style={styles.td}><span style={styles.metricName}>{m.name.replace(/_/g,' ')}</span></td>
                <td style={styles.td}>{Number(m.total).toLocaleString()}</td>
                <td style={styles.td}>{Number(m.average).toLocaleString()}</td>
                <td style={styles.td}>{m.data_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

const styles = {
  page:    { display: 'flex', flexDirection: 'column', gap: 24 },
  loading: { color: 'var(--muted)', padding: 40 },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  h1:      { fontSize: 24, fontWeight: 600, letterSpacing: '-0.5px' },
  sub:     { color: 'var(--muted)', fontSize: 14, marginTop: 4 },
  grid4:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  chartCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px 24px',
  },
  chartHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  chartTitle:  { fontSize: 14, fontWeight: 600 },
  chartBadge:  {
    fontSize: 11, padding: '2px 8px', borderRadius: 20,
    background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid var(--border)',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: 11, color: 'var(--muted)', padding: '8px 12px',
        textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' },
  td: { padding: '11px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid rgba(255,255,255,0.03)' },
  metricName: { textTransform: 'capitalize', fontWeight: 500 },
}
