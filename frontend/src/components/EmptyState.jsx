export default function EmptyState({ icon: Icon, children }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={26} />}
      <p>{children}</p>
    </div>
  )
}
