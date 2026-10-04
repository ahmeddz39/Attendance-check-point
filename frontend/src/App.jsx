import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CompanyProvider } from './context/CompanyContext'
import Login     from './pages/Login'
import ActivateLicense from './pages/ActivateLicense'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Reports   from './pages/Reports'
import Users     from './pages/Users'
import Devices   from './pages/Devices'
import Employees from './pages/Employees'
import AttendanceLogs from './pages/AttendanceLogs'
import Salary from './pages/Salary'
import Leave from './pages/Leave'
import Settings from './pages/Settings'
import SettingsGeneral    from './pages/settings/SettingsGeneral'
import SettingsShift      from './pages/settings/SettingsShift'
import SettingsAppearance from './pages/settings/SettingsAppearance'
import SettingsLanguage   from './pages/settings/SettingsLanguage'
import Layout    from './components/Layout'

const Private = ({ children, roles }) => {
  const { user, loading } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--muted)'}}>Loading…</div>
  if (!user)   return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

// The Settings index route used to be hard-gated to admin (via <Private>,
// which redirects to "/" on a role mismatch) -- since "/settings" itself
// renders this index route too, an analyst clicking the Settings nav link
// got bounced straight back out before ever seeing the tabs they DO have
// access to (Shift & Holidays, Appearance, Language). Send them to the
// first tab they can use instead of booting them out of Settings entirely.
const SettingsIndex = () => {
  const { user } = useAuth()
  if (user?.role === 'admin') return <SettingsGeneral />
  return <Navigate to="/settings/shift" replace />
}

// Blocks the app shell behind an active license -- an admin can still log in
// (that route lives outside this gate) to reach the activation screen.
const LicenseGate = ({ children }) => {
  const { authFetch } = useAuth()
  const [status, setStatus] = useState(null) // null = checking

  const check = () => {
    authFetch('/api/license/status')
      .then(res => res?.ok && res.json())
      .then(data => setStatus(data?.data?.activated ?? false))
      .catch(() => setStatus(false))
  }

  useEffect(check, [authFetch])

  if (status === null) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--muted)'}}>Loading…</div>
  if (!status) return <ActivateLicense onActivated={check} />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Private><LicenseGate><CompanyProvider><Layout /></CompanyProvider></LicenseGate></Private>}>
          <Route index         element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports"   element={<Reports />} />
          <Route path="employees" element={<Private roles={['admin','analyst']}><Employees /></Private>} />
          <Route path="attendance" element={<Private roles={['admin','analyst']}><AttendanceLogs /></Private>} />
          <Route path="salary"    element={<Private roles={['admin']}><Salary /></Private>} />
          <Route path="leave"     element={<Private roles={['admin','analyst']}><Leave /></Private>} />
          <Route path="settings" element={<Private roles={['admin','analyst']}><Settings /></Private>}>
            <Route index          element={<SettingsIndex />} />
            <Route path="users"      element={<Private roles={['admin']}><Users /></Private>} />
            <Route path="devices"    element={<Private roles={['admin']}><Devices /></Private>} />
            <Route path="shift"      element={<Private roles={['admin','analyst']}><SettingsShift /></Private>} />
            <Route path="appearance" element={<SettingsAppearance />} />
            <Route path="language"   element={<SettingsLanguage />} />
          </Route>
          <Route path="users"   element={<Navigate to="/settings/users" replace />} />
          <Route path="devices" element={<Navigate to="/settings/devices" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
