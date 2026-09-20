import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import SegmentedControl from '../components/SegmentedControl'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { SkeletonBlock } from '../components/Skeleton'
import { localeFor } from '../i18n/formatDate'
import useAutoRefresh from '../hooks/useAutoRefresh'
import { BarChart2 } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

const RANGE_VALUES = [7, 14, 30, 90]

export default function Analytics() {
  const { t, i18n } = useTranslation()
  const { authFetch } = useAuth()
  const [days, setDays] = useState(30)
  const [chartType, setChartType] = useState('line')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const RANGES = RANGE_VALUES.map(v => ({ value: v, label: `${v}d` }))
  const CHART_TYPES = [
    { value: 'line', label: t('trends.chartTypeLine') },
    { value: 'bar',  label: t('trends.chartTypeBar') },
  ]
  const SERIES = {
    present:    { label: t('common.status.present'),    color: 'var(--accent)' },
    incomplete: { label: t('common.status.incomplete'), color: 'var(--warn)' },
    absent:     { label: t('common.status.absent'),     color: 'var(--danger)' },
    rate:       { label: t('trends.attendanceRate'), color: 'var(--accent2)' },
  }

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    const locale = localeFor(i18n.language)
    authFetch(`/api/attendance/reports/trend?days=${days}`)
      .then(r => r?.json())
      .then(d => {
        const data = (d?.data?.rows || []).map(r => ({
          date: new Date(r.workDay).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
          present: r.present,
          incomplete: r.incomplete,
          absent: r.absent,
          rate: r.rate,
          scheduled: r.scheduled,
        }))
        setRows(data)
      })
      .catch(err => {
        console.error('Trends load error:', err)
        setRows([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [days, authFetch, i18n.language])
  useAutoRefresh(() => load(true), 60000)

  return (
    <div style={styles.page} className="fade-in">
      <PageHeader
        title={t('trends.title')}
        subtitle={t('trends.subtitle')}
        actions={<>
          <SegmentedControl options={RANGES} value={days} onChange={setDays} />
          <SegmentedControl options={CHART_TYPES} value={chartType} onChange={setChartType} />
        </>}
      />

      <div className="card" style={styles.cardPad}>
        <div style={styles.cardHeader}>
          <span style={styles.cardHeaderTitle}>{t('trends.chartTitle')}</span>
        </div>
        {loading ? <SkeletonBlock height={320} /> : rows.length === 0 ? (
          <EmptyState icon={BarChart2}>{t('trends.dailyBreakdown')}</EmptyState>
        ) : (
        <ResponsiveContainer width="100%" height={320}>
          {chartType === 'line' ? (
            <LineChart data={rows} margin={{ top:10, right:10, left:-20, bottom:0 }}>
              <CartesianGrid stroke="var(--chart-line)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill:'var(--chart-label)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--chart-label)', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'var(--tooltip-bg)', border:'1px solid var(--tooltip-border)', borderRadius:8, fontSize:13 }}
                labelStyle={{ color:'var(--tooltip-text)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="present"    stroke={SERIES.present.color}    strokeWidth={2.5} dot={false} name={SERIES.present.label} />
              <Line type="monotone" dataKey="incomplete" stroke={SERIES.incomplete.color} strokeWidth={2}   dot={false} name={SERIES.incomplete.label} />
              <Line type="monotone" dataKey="absent"     stroke={SERIES.absent.color}     strokeWidth={2}   dot={false} name={SERIES.absent.label} />
            </LineChart>
          ) : (
            <BarChart data={rows} margin={{ top:10, right:10, left:-20, bottom:0 }}>
              <CartesianGrid stroke="var(--chart-line)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill:'var(--chart-label)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--chart-label)', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'var(--tooltip-bg)', border:'1px solid var(--tooltip-border)', borderRadius:8, fontSize:13 }}
                labelStyle={{ color:'var(--tooltip-text)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="present"    stackId="a" fill={SERIES.present.color}    name={SERIES.present.label} />
              <Bar dataKey="incomplete" stackId="a" fill={SERIES.incomplete.color} name={SERIES.incomplete.label} radius={[0,0,0,0]} />
              <Bar dataKey="absent"     stackId="a" fill={SERIES.absent.color}     name={SERIES.absent.label} radius={[4,4,0,0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
        )}
      </div>

      {/* Data table */}
      <div className="card" style={styles.cardPad}>
        <div style={styles.cardHeader}><span style={styles.cardHeaderTitle}>{t('trends.dailyBreakdown')}</span></div>
        <div style={{overflowX:'auto'}}>
          <table className="table">
            <thead><tr>
              <th>{t('trends.colDate')}</th>
              <th className="num">{t('trends.colScheduled')}</th>
              <th className="num">{t('common.status.present')}</th>
              <th className="num">{t('common.status.incomplete')}</th>
              <th className="num">{t('common.status.absent')}</th>
              <th className="num">{t('trends.rate')}</th>
            </tr></thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.date}</td>
                  <td className="num" style={{color:'var(--muted)'}}>{row.scheduled}</td>
                  <td className="num" style={{color:SERIES.present.color}}>{row.present}</td>
                  <td className="num" style={{color:SERIES.incomplete.color}}>{row.incomplete}</td>
                  <td className="num" style={{color:SERIES.absent.color}}>{row.absent}</td>
                  <td className="num" style={{color:SERIES.rate.color}}>{row.rate}%</td>
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
  cardPad: { padding:'20px 24px' },
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  cardHeaderTitle: { fontSize:14, fontWeight:600 },
}
