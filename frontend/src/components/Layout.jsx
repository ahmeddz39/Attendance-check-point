import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, BarChart2, FileText, Users, LogOut, CheckSquare } from 'lucide-react'

const nav = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',  exact: true },
  { to: '/analytics', icon: BarChart2,       label: 'Analytics' },
  { to: '/reports',   icon: FileText,        label: 'Reports' },
  { to: '/users',     icon: Users,           label: 'Users',     roles: ['admin','analyst'] },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => { await logout(); navigate('/login') }

  const roleColor = { admin: 'var(--accent)', analyst: 'var(--accent2)', viewer: 'var(--warn)' }

  return (
    <div style={styles.shell}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sideTop}>
          <div style={styles.logo}>
            <CheckSquare size={18} color="#0d0f12" />
            <span style={styles.logoText}>A·Check</span>
          </div>

          <nav style={styles.nav}>
            {nav.filter(n => !n.roles || n.roles.includes(user?.role)).map(({ to, icon: Icon, label, exact }) => (
              <NavLink
                key={to} to={to} end={exact}
                style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navActive : {}) })}
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div style={styles.sideBottom}>
          <div style={styles.userCard}>
            <div style={styles.avatar}>{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={styles.userName}>{user?.firstName} {user?.lastName}</div>
              <div style={{...styles.roleTag, color: roleColor[user?.role]}}>{user?.role}</div>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  shell:   { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: {
    width: 220, flexShrink: 0, background: 'var(--bg2)',
    borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '20px 12px',
  },
  sideTop: { display: 'flex', flexDirection: 'column', gap: 28 },
  logo: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px',
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    borderRadius: 8, width: 'fit-content',
  },
  logoText: { fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: '#0d0f12' },
  nav:  { display: 'flex', flexDirection: 'column', gap: 2 },
  navLink: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    color: 'var(--muted)', fontSize: 14, fontWeight: 500,
    transition: 'all 0.15s',
  },
  navActive: { color: 'var(--text)', background: 'var(--bg3)' },
  sideBottom: { display: 'flex', flexDirection: 'column', gap: 8 },
  userCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', background: 'var(--bg3)',
    borderRadius: 8, border: '1px solid var(--border)',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#0d0f12',
  },
  userName: { fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  roleTag:  { fontSize: 11, fontFamily: 'var(--mono)', marginTop: 1 },
  logoutBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '8px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--muted)', fontSize: 13,
    transition: 'all 0.15s',
  },
  main: { flex: 1, overflow: 'auto', padding: '32px 36px', background: 'var(--bg)' },
}
