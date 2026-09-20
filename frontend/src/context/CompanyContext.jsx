import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const CompanyContext = createContext(null)

const DEFAULT_NAME = 'Attendance Checkpoint'

export function CompanyProvider({ children }) {
  const { authFetch } = useAuth()
  const [companyName, setCompanyName] = useState(DEFAULT_NAME)
  const [logoUrl, setLogoUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const res = await authFetch('/api/settings')
    const data = await res?.json()
    const s = data?.data
    if (s) {
      setCompanyName(s.company_name || DEFAULT_NAME)
      setLogoUrl(s.logo_url || null)
    }
    setLoading(false)
  }, [authFetch])

  useEffect(() => { refresh() }, [refresh])

  return (
    <CompanyContext.Provider value={{ companyName, logoUrl, loading, refresh }}>
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => useContext(CompanyContext)
