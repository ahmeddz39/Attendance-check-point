const TONES = {
  accent: 'badge-accent',
  accent2: 'badge-accent2',
  danger: 'badge-danger',
  warn: 'badge-warn',
  muted: 'badge-muted',
}

export default function Badge({ tone = 'muted', children }) {
  return <span className={`badge ${TONES[tone] || TONES.muted}`}>{children}</span>
}
