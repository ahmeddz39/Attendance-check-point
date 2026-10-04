import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'

export default function Settings() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const tabs = [
    { to: '/settings',           end: true, label: t('settings.tabGeneral'),  roles: ['admin'] },
    { to: '/settings/users',     label: t('settings.tabUsers'),      roles: ['admin'] },
    { to: '/settings/devices',   label: t('settings.tabDevices'),    roles: ['admin'] },
    { to: '/settings/shift',     label: t('settings.tabShift'),      roles: ['admin', 'analyst'] },
    { to: '/settings/appearance', label: t('settings.tabAppearance') },
    { to: '/settings/language',  label: t('settings.tabLanguage') },
  ]

  return (
    <div className="fade-in" style={styles.page}>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="pill-group" style={styles.tabs}>
        {tabs.filter(tab => !tab.roles || tab.roles.includes(user?.role)).map(tab => (
          <NavLink
            key={tab.to} to={tab.to} end={tab.end}
            className={({ isActive }) => `pill ${isActive ? 'active' : ''}`.trim()}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  tabs: { alignSelf: 'flex-start', flexWrap: 'wrap' },
}
