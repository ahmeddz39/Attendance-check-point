import { ArrowUp, ArrowDown } from 'lucide-react'

const TONES = {
  accent:  { color: 'var(--accent)',  soft: 'var(--accent-soft)' },
  accent2: { color: 'var(--accent2)', soft: 'var(--accent2-soft)' },
  danger:  { color: 'var(--danger)',  soft: 'var(--danger-soft)' },
  warn:    { color: 'var(--warn)',    soft: 'var(--warn-soft)' },
}

export default function StatCard({ label, value, sub, tone = 'accent', icon: Icon, delta, deltaLabel, invertDelta = false }) {
  const { color, soft } = TONES[tone] || TONES.accent
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  const isUp = hasDelta && delta >= 0
  // Direction (isUp) controls the arrow; "goodness" (isGood) controls the color, since
  // an increase isn't always good -- e.g. more absences going up is bad, not green.
  const isGood = hasDelta && (invertDelta ? !isUp : isUp)
  const DeltaIcon = isUp ? ArrowUp : ArrowDown

  return (
    <div className="stat-card fade-in">
      <div style={styles.top}>
        <span style={styles.label}>{label}</span>
        {Icon && <div style={{...styles.iconWrap, background: soft}}>
          <Icon size={15} color={color} />
        </div>}
      </div>
      <div style={{...styles.value, color}}>{value}</div>
      <div className="stat-card-bottom">
        {sub && <div style={styles.sub}>{sub}</div>}
        {hasDelta && (
          <span className={`stat-card-delta ${isGood ? 'up' : 'down'}`}>
            <DeltaIcon size={11} />
            {Math.abs(delta)}%{deltaLabel ? ` ${deltaLabel}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

const styles = {
  top:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 12, color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.4px', textTransform: 'uppercase' },
  iconWrap: { width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 28, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '-1px' },
  sub:   { fontSize: 12, color: 'var(--muted)' },
}
