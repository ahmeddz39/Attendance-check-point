import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]   = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  const tokenRef = useRef(token)
  tokenRef.current = token
  const refreshInFlight = useRef(null)

  // Access tokens are short-lived (15m); this exchanges the long-lived
  // refresh token for a new pair. Dedupes concurrent callers so a burst of
  // 401s from parallel requests only triggers one /refresh call.
  const doRefresh = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current

    const rt = localStorage.getItem('refreshToken')
    if (!rt) return Promise.resolve(null)

    refreshInFlight.current = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.data?.accessToken) return null
        localStorage.setItem('token', d.data.accessToken)
        localStorage.setItem('refreshToken', d.data.refreshToken)
        setToken(d.data.accessToken)
        return d.data.accessToken
      })
      .catch(() => null)
      .finally(() => { refreshInFlight.current = null })

    return refreshInFlight.current
  }, [])

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        if (r.status === 401) {
          const newToken = await doRefresh()
          if (!newToken) throw new Error('HTTP 401')
          return fetch('/api/auth/me', { headers: { Authorization: `Bearer ${newToken}` } })
            .then(r2 => { if (!r2.ok) throw new Error(`HTTP ${r2.status}`); return r2.json() })
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => setUser(d.data))
      .catch((err) => {
        console.debug('Auth validation failed:', err.message)
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        setUser(null)
        setToken(null)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Login failed')
    localStorage.setItem('token', data.data.accessToken)
    localStorage.setItem('refreshToken', data.data.refreshToken)
    setToken(data.data.accessToken)
    setUser(data.data.user)
    return data.data.user
  }

  const logout = useCallback(async () => {
    const rt = localStorage.getItem('refreshToken')
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setUser(null)
    setToken(null)
  }, [])

  const authFetch = useCallback(async (url, opts = {}) => {
    const res = await fetch(url, {
      ...opts,
      headers: { ...opts.headers, Authorization: `Bearer ${tokenRef.current}` },
    })
    if (res.status !== 401) return res

    // Access token likely expired -- try once to refresh and retry.
    const newToken = await doRefresh()
    if (!newToken) { logout(); return null }

    const retry = await fetch(url, {
      ...opts,
      headers: { ...opts.headers, Authorization: `Bearer ${newToken}` },
    })
    if (retry.status === 401) { logout(); return null }
    return retry
  }, [doRefresh, logout])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
