import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import StatCard from '../components/StatCard'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { SkeletonStatCard, SkeletonBlock } from '../components/Skeleton'
import { localeFor, formatDateTime } from '../i18n/formatDate'
import useAutoRefresh from '../hooks/useAutoRefresh'
import { UserCheck, UserX, Clock3, Router as RouterIcon, Wallet, Inbox } from 'lucide-react'

const currentMonth = () => new Date().toISOString().slice(0, 7)

const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' DZD'

const pctDelta = (today, yesterday) => {
  if (yesterday === undefined || yesterday === null || yesterday === 0) return null
  return Math.round(((today - yesterday) / yesterday) * 100)
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const { authFetch, user } = useAuth()
  const [trend, setTrend] = useState([])
  const [salary, setSalary] = useState(null)
  const [devices, setDevices] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    Promise.all([
      authFetch('/api/attendance/reports/trend?days=7').then(r => r?.json()),
      user?.role === 'admin' ? authFetch(`/api/attendance/salary?month=${currentMonth()}`).then(r => r?.json()) : Promise.resolve(null),
      authFetch('/api/devices').then(r => r?.json()),
      authFetch('/api/attendance/logs').then(r => r?.json()),
    ]).then(([trendRes, s, d, l]) => {
      setTrend(trendRes?.data?.rows || [])
      setSalary(s?.data)
      setDevices(d?.data || [])
      setRecentLogs((l?.data || []).slice(0, 8))
    }).catch(err => console.error('Dashboard load error:', err))
      .finally(() => setLoading(false))
  }

  useEffect(load, [authFetch])
  useAutoRefresh(load, 60000)

  const locale = localeFor(i18n.language)
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'greetingMorning' : hour < 17 ? 'greetingAfternoon' : 'greetingEvening'
  const today = trend[trend.length - 1]
  const yesterday = trend[trend.length - 2]
  const devicesOnline = devices.filter(d => d.status === 'online').length

  const header = (
    <PageHeader
      title={t(`dashboard.${greetingKey}`, { name: user?.firstName })}
      subtitle={today ? new Date(today.workDay).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }) : t('dashboard.subtitleFallback')}
    />
  )

  if (loading) {
    return (
      <div style={styles.page} className="fade-in">
        {header}
        <div className="stat-grid">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <SkeletonBlock height={280} />
        <SkeletonBlock height={220} />
      </div>
    )
  }

  const chartData = trend.map(row => ({
    date: new Date(row.workDay).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    present: row.present,
    incomplete: row.incomplete,
    absent: row.absent,
  }))

  const initialsOf = (first, last) => `${(first || '?')[0]}${(last || '')[0] || ''}`.toUpperCase()

  return (
    <div style={styles.page} className="fade-in">
      {header}

      {/* Today */}
      <div className="stat-grid">
        <StatCard
          label={t('dashboard.presentToday')} value={today?.present ?? '—'}
          sub={t('dashboard.ofScheduled', { count: today?.scheduled ?? 0 })}
          icon={UserCheck} tone="accent"
          delta={today && yesterday ? pctDelta(today.present, yesterday.present) : null}
        />
        <StatCard
          label={t('dashboard.checkedInNoCheckout')} value={today?.incomplete ?? '—'}
          sub={t('dashboard.stillOnSite')} icon={Clock3} tone="warn"
        />
        <StatCard
          label={t('dashboard.absentToday')} value={today?.absent ?? '—'}
          sub={t('dashboard.noPunchYet')} icon={UserX} tone="danger"
          delta={today && yesterday ? pctDelta(today.absent, yesterday.absent) : null}
          invertDelta
        />
        <StatCard
          label={t('dashboard.devicesOnline')} value={`${devicesOnline}/${devices.length}`}
          sub={t('dashboard.attendanceTerminals')} icon={RouterIcon} tone="accent2"
        />
      </div>

      {/* This month */}
      {salary?.totals && (
        <div style={styles.section}>
          <span className="section-label">{t('dashboard.thisMonth')}</span>
          <div className="stat-grid" style={{ marginTop: 10 }}>
            <StatCard label={t('dashboard.payrollMtd')} value={fmtMoney(salary.totals.estimatedSalary)} sub={currentMonth()} icon={Wallet} tone="accent" />
            <StatCard label={t('dashboard.presentDaysMtd')} value={salary.totals.presentDays} sub={t('dashboard.employeesCount', { count: salary.totals.employees })} icon={UserCheck} tone="accent2" />
            <StatCard label={t('dashboard.absentDaysMtd')} value={salary.totals.absentDays} sub={t('dashboard.scheduledWorkdaysMissed')} icon={UserX} tone="danger" />
            <StatCard label={t('dashboard.hoursWorkedMtd')} value={Number(salary.totals.workedHours).toFixed(0)} sub={t('dashboard.totalHours')} icon={Clock3} tone="warn" />
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card" style={styles.chartCard}>
        <div style={styles.chartHeader}>
          <span style={styles.chartTitle}>{t('dashboard.attendanceLast7Days')}</span>
          <span className="badge badge-muted">7d</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--warn)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--warn)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--danger)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-line)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: 'var(--chart-label)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--chart-label)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background:'var(--tooltip-bg)', border:'1px solid var(--tooltip-border)', borderRadius:8, fontSize:13 }}
              labelStyle={{ color:'var(--tooltip-text)' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="absent" stroke="var(--danger)" strokeWidth={1.5} fill="url(#ag)" name={t('common.status.absent')} />
            <Area type="monotone" dataKey="incomplete" stroke="var(--warn)" strokeWidth={1.5} fill="url(#ig)" name={t('common.status.incomplete')} />
            <Area type="monotone" dataKey="present" stroke="var(--accent)" strokeWidth={2.5} fill="url(#pg)" name={t('common.status.present')} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent activity */}
      <div className="card" style={styles.chartCard}>
        <div style={styles.chartHeader}>
          <span style={styles.chartTitle}>{t('dashboard.recentPunches')}</span>
        </div>
        {recentLogs.length === 0 ? (
          <EmptyState icon={Inbox}>{t('dashboard.noPunchesYet')}</EmptyState>
        ) : (
          <div style={styles.activityList}>
            {recentLogs.map((log, i) => {
              const name = log.first_name ? `${log.first_name} ${log.last_name || ''}` : t('dashboard.deviceIdLabel', { id: log.device_user_id })
              return (
                <div key={log.id || i} style={{...styles.activityRow, borderBottom: i === recentLogs.length - 1 ? 'none' : '1px solid var(--border)'}}>
                  <div style={styles.activityAvatar}>{initialsOf(log.first_name, log.last_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.activityName}>{name}</div>
                    <div style={styles.activityMuted}>{log.device_name || '-'}</div>
                  </div>
                  <div style={styles.activityTime}>{formatDateTime(log.event_time, i18n.language)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page:    { display: 'flex', flexDirection: 'column', gap: 24 },
  section: { display: 'flex', flexDirection: 'column' },
  chartCard: { padding: '20px 24px' },
  chartHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  chartTitle:  { fontSize: 14, fontWeight: 600 },
  activityList: { display: 'flex', flexDirection: 'column' },
  activityRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 2px' },
  activityAvatar: {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: 'var(--on-accent)',
  },
  activityName: { fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  activityMuted: { fontSize: 12, color: 'var(--muted)', marginTop: 1 },
  activityTime: { fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' },
}
