import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

export default function LoginPage() {
  const { user, loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]       = useState('login')   // 'login' | 'register'
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [pass2, setPass2]   = useState('')
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState(false)

  if (user) return <Navigate to="/" replace />

  const friendlyError = (code) => {
    const map = {
      'auth/user-not-found':       'USER NOT FOUND.',
      'auth/wrong-password':       'INCORRECT PASSWORD.',
      'auth/invalid-credential':   'INVALID CREDENTIALS.',
      'auth/email-already-in-use': 'EMAIL ALREADY REGISTERED.',
      'auth/weak-password':        'PASSWORD TOO WEAK — MIN 6 CHARS.',
      'auth/invalid-email':        'INVALID EMAIL FORMAT.',
      'auth/too-many-requests':    'TOO MANY ATTEMPTS. TRY LATER.',
    }
    return map[code] || 'UNEXPECTED ERROR. TRY AGAIN.'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (tab === 'register' && pass !== pass2) {
      setError('PASSWORDS DO NOT MATCH.')
      return
    }
    setBusy(true)
    try {
      if (tab === 'login') {
        await loginWithEmail(email, pass)
      } else {
        await registerWithEmail(email, pass)
      }
      navigate('/')
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      await loginWithGoogle()
      navigate('/')
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="tile-bg" />

      <div className="pixel-panel crt fade-up" style={{ width: '100%', maxWidth: '400px', padding: '40px 36px' }}>

        {/* Logo / title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '22px', color: 'var(--green)', letterSpacing: '2px', lineHeight: 1.4 }}>
            WEB<span style={{ color: 'var(--amber)' }}>TILE</span>
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '16px', color: 'var(--text-dim)', marginTop: '6px', letterSpacing: '3px' }}>
            RETRO TILEMAP EDITOR
          </div>
          <div style={{ width: '100%', height: '1px', background: 'var(--border)', marginTop: '20px' }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: '28px', gap: '2px' }}>
          {['login', 'register'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              style={{
                flex: 1,
                padding: '10px',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px',
                letterSpacing: '1px',
                background: tab === t ? 'var(--green)' : 'transparent',
                color: tab === t ? '#000' : 'var(--text-dim)',
                border: tab === t ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t === 'login' ? 'LOG IN' : 'REGISTER'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label className="pixel-label">EMAIL</label>
            <input
              className="pixel-input"
              type="email"
              placeholder="user@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="pixel-label">PASSWORD</label>
            <input
              className="pixel-input"
              type="password"
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="pixel-label">CONFIRM PASSWORD</label>
              <input
                className="pixel-input"
                type="password"
                placeholder="••••••••"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <div className="msg-error">&#x25B6; {error}</div>}

          <button className="btn-pixel" type="submit" disabled={busy} style={{ width: '100%', marginTop: '4px' }}>
            {busy ? 'LOADING...' : tab === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: 'var(--text-dim)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Google */}
        <button className="btn-google" onClick={handleGoogle} disabled={busy}>
          {GOOGLE_ICON}
          CONTINUE WITH GOOGLE
        </button>

        {/* Forgot password — only on login tab */}
        {tab === 'login' && (
          <div style={{ textAlign: 'center', marginTop: '22px' }}>
            <Link
              to="/forgot-password"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: 'var(--text-dim)', textDecoration: 'none', letterSpacing: '1px', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.target.style.color = 'var(--green)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-dim)'}
            >
              FORGOT PASSWORD?
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
