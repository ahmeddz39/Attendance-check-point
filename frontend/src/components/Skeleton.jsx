export function SkeletonBar({ width = '100%', height = 14, style }) {
  return <span className="skeleton" style={{ display: 'inline-block', width, height, ...style }} />
}

export function SkeletonBlock({ height = 80, style }) {
  return <div className="skeleton" style={{ height, borderRadius: 10, ...style }} />
}

export function SkeletonStatCard() {
  return (
    <div className="stat-card">
      <SkeletonBar width="60%" height={11} />
      <div style={{ marginTop: 16 }}><SkeletonBar width="45%" height={26} /></div>
      <div style={{ marginTop: 10 }}><SkeletonBar width="70%" height={11} /></div>
    </div>
  )
}

export function SkeletonTableRows({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}><SkeletonBar height={12} width={c === 0 ? '80%' : '55%'} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}
