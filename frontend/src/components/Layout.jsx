import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { LayoutDashboard, BarChart2, FileText, Users, LogOut, CheckSquare, Router, Clock, WalletCards, Palmtree, Settings as SettingsIcon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, KeyRound } from 'lucide-react'
import Modal from './Modal'

const NARROW_QUERY = '(max-width: 900px)'

const getStoredCollapsed = () => {
  try {
    const v = localStorage.getItem('sidebarCollapsed')
    return v === null ? null : v === 'true'
  } catch { return null }
}

const matchesNarrow = () => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches

const nav = [
  { to: '/',          icon: LayoutDashboard, key: 'dashboard',  exact: true },
  { to: '/analytics', icon: BarChart2,       key: 'trends',    roles: ['admin','analyst'] },
  { to: '/reports',   icon: FileText,        key: 'reports' },
  { to: '/employees', icon: Users,           key: 'employees', roles: ['admin','analyst'] },
  { to: '/attendance', icon: Clock,          key: 'attendance', roles: ['admin','analyst'] },
  { to: '/salary',    icon: WalletCards,     key: 'salary',    roles: ['admin'] },
  { to: '/leave',     icon: Palmtree,        key: 'leave',     roles: ['admin','analyst'] },
  { to: '/settings',  icon: SettingsIcon,    key: 'settings',  roles: ['admin','analyst'] },
]

export default function Layout() {
  const { t, i18n } = useTranslation()
  const { user, logout, authFetch } = useAuth()
  const { companyName, logoUrl } = useCompany()
  const navigate = useNavigate()
  const [manualCollapsed, setManualCollapsed] = useState(getStoredCollapsed)
  const [isNarrow, setIsNarrow] = useState(matchesNarrow)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const collapsed = manualCollapsed !== null ? manualCollapsed : isNarrow

  const isRtl = i18n.language === 'ar'
  const CloseIcon = isRtl ? PanelRightClose : PanelLeftClose
  const OpenIcon = isRtl ? PanelRightOpen : PanelLeftOpen

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const handler = (e) => setIsNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setManualCollapsed(next)
    try { localStorage.setItem('sidebarCollapsed', String(next)) } catch {}
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordError('')
    setPasswordSuccess(false)
  }

  const submitPasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    if (passwordForm.newPassword.length < 10) { setPasswordError(t('account.passwordTooShort')); return }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError(t('account.passwordMismatch')); return }

    setPasswordSaving(true)
    const res = await authFetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
    })
    const data = await res?.json().catch(() => ({}))
    if (!res?.ok) {
      setPasswordError(data?.error?.message || t('account.changeFailed'))
      setPasswordSaving(false)
      return
    }
    setPasswordSuccess(true)
    setTimeout(async () => {
      await logout()
      navigate('/login')
    }, 1800)
  }

  const roleColor = { admin: 'var(--accent)', analyst: 'var(--accent2)', viewer: 'var(--warn)' }

  return (
    <div style={styles.shell}>
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`.trim()}>
        <div className="sidebar-inner" style={styles.sidebarInner}>
          <div style={styles.sideTop}>
            <div style={{ ...styles.logoRow, flexDirection: collapsed ? 'column' : 'row' }}>
              {logoUrl
                ? <img src={logoUrl} alt="" style={styles.logoImg} title={companyName} />
                : <span style={styles.logoBadge} title={companyName}><CheckSquare size={18} color="var(--on-accent)" /></span>}
              {!collapsed && <span style={styles.logoText}>{companyName}</span>}
              <button
                type="button"
                className="icon-btn"
                onClick={toggleCollapsed}
                title={collapsed ? t('nav.showSidebar') : t('nav.hideSidebar')}
              >
                {collapsed ? <OpenIcon size={16} /> : <CloseIcon size={16} />}
              </button>
            </div>

            <nav style={styles.nav}>
              {nav.filter(n => !n.roles || n.roles.includes(user?.role)).map(({ to, icon: Icon, key, exact }) => (
                <NavLink
                  key={to} to={to} end={exact}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`.trim()}
                  title={t(`nav.${key}`)}
                >
                  <Icon size={16} />
                  {!collapsed && t(`nav.${key}`)}
                </NavLink>
              ))}
            </nav>
          </div>

          <div style={styles.sideBottom}>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              style={{ ...styles.userCard, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '10px 12px', cursor: 'pointer' }}
              title={t('account.changePassword')}
            >
              <div style={styles.avatar} title={`${user?.firstName || ''} ${user?.lastName || ''}`}>{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
              {!collapsed && (
                <div style={{flex:1, minWidth:0, textAlign: 'start'}}>
                  <div style={styles.userName}>{user?.firstName} {user?.lastName}</div>
                  <div style={{...styles.roleTag, color: roleColor[user?.role]}}>{t(`common.roles.${user?.role}`, user?.role)}</div>
                </div>
              )}
              {!collapsed && <KeyRound size={14} color="var(--muted)" />}
            </button>
            <button className="btn btn-ghost" style={styles.logoutBtn} onClick={handleLogout} title={t('nav.signOut')}>
              <LogOut size={15} /> {!collapsed && t('nav.signOut')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="app-main">
        <Outlet />
      </main>

      <Modal
        open={showPasswordModal}
        onClose={closePasswordModal}
        title={t('account.changePassword')}
        subtitle={passwordSuccess ? null : t('account.changePasswordSubtitle')}
        footer={passwordSuccess ? null : (
          <>
            <button type="button" onClick={closePasswordModal} className="btn btn-ghost">{t('common.cancel')}</button>
            <button type="submit" form="change-password-form" className="btn btn-primary" disabled={passwordSaving}>
              {passwordSaving ? t('account.changing') : t('account.changePassword')}
            </button>
          </>
        )}
      >
        {passwordSuccess ? (
          <div style={styles.successMsg}>{t('account.changeSuccess')}</div>
        ) : (
          <form id="change-password-form" onSubmit={submitPasswordChange} style={styles.passwordForm}>
            <input
              className="input" type="password" required autoFocus
              placeholder={t('account.currentPassword')}
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
            />
            <input
              className="input" type="password" required minLength={10}
              placeholder={t('account.newPassword')}
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
            />
            <input
              className="input" type="password" required minLength={10}
              placeholder={t('account.confirmPassword')}
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
            />
            {passwordError && <div style={styles.errorMsg}>{passwordError}</div>}
          </form>
        )}
      </Modal>
    </div>
  )
}

const styles = {
  shell:   { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebarInner: {
    width: '100%', flexShrink: 0, height: '100%',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  },
  sideTop: { display: 'flex', flexDirection: 'column', gap: 28 },
  logoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 },
  logoBadge: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, flexShrink: 0, borderRadius: 8,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
  },
  logoImg: { width: 28, height: 28, flexShrink: 0, borderRadius: 8, objectFit: 'cover' },
  logoText: {
    fontWeight: 700, fontSize: 14, color: 'var(--text)', flex: 1,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  nav:  { display: 'flex', flexDirection: 'column', gap: 2 },
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
    fontSize: 11, fontWeight: 700, color: 'var(--on-accent)',
  },
  userName: { fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  roleTag:  { fontSize: 11, fontFamily: 'var(--mono)', marginTop: 1 },
  logoutBtn: { width: '100%', justifyContent: 'center' },
  passwordForm: { display: 'flex', flexDirection: 'column', gap: 10 },
  errorMsg: { color: 'var(--danger)', fontSize: 13 },
  successMsg: { color: 'var(--accent)', fontSize: 14, padding: '8px 0' },
}
