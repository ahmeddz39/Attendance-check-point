export default function StatCard({ label, value, sub, accent, icon: Icon }) {
  return (
    <div style={styles.card} className="fade-in">
      <div style={styles.top}>
        <span style={styles.label}>{label}</span>
        {Icon && <div style={{...styles.iconWrap, background: accent || 'var(--accent)' + '22'}}>
          <Icon size={15} color={accent || 'var(--accent)'} />
        </div>}
      </div>
      <div style={{...styles.value, color: accent || 'var(--text)'}}>{value}</div>
      {sub && <div style={styles.sub}>{sub}</div>}
    </div>
  )
}

const styles = {
  card: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px 22px',
  },
  top:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 12, color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.4px', textTransform: 'uppercase' },
  iconWrap: { width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 28, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '-1px' },
  sub:   { fontSize: 12, color: 'var(--muted)', marginTop: 5 },
}
