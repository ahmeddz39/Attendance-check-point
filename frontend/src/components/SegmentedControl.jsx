export default function SegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div className={`pill-group ${className}`.trim()}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`pill ${value === opt.value ? 'active' : ''}`.trim()}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon ? <opt.icon size={13} /> : null}
          {opt.label}
        </button>
      ))}
    </div>
  )
}
