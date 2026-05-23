import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card} className="fade-in">
        {/* Logo / Brand */}
        <div style={styles.brand}>
          <div style={styles.logo}>AC</div>
          <div>
            <div style={styles.brandName}>Attendance Checkpoint</div>
            <div style={styles.brandSub}>Internal Analytics Platform</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email" value={email} required autoFocus
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password" value={password} required
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button style={{...styles.btn, opacity: loading ? 0.7 : 1}} disabled={loading} type="submit">
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <div style={styles.hint}>
          <span style={{color:'var(--muted)', fontSize:12}}>Dev credentials: </span>
          <span style={{fontFamily:'var(--mono)', fontSize:11, color:'var(--muted)'}}>admin@dashboard.local / Admin1234!</span>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse at 60% 20%, #0f2027 0%, var(--bg) 70%)',
    padding: 24,
  },
  card: {
    width: '100%', maxWidth: 420,
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '40px 36px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 },
  logo: {
    width: 44, height: 44, borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: '#0d0f12',
    flexShrink: 0,
  },
  brandName: { fontWeight: 600, fontSize: 16, letterSpacing: '-0.3px' },
  brandSub:  { fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  form:  { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--muted)', letterSpacing: '0.3px' },
  input: {
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
    padding: '11px 14px', color: 'var(--text)', fontSize: 14,
    outline: 'none', transition: 'border-color 0.2s',
  },
  btn: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    border: 'none', borderRadius: 8, padding: '13px',
    color: '#0d0f12', fontWeight: 600, fontSize: 15, marginTop: 6,
    transition: 'opacity 0.2s, transform 0.1s',
  },
  error: {
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13,
  },
  hint: { marginTop: 24, textAlign: 'center' },
}
