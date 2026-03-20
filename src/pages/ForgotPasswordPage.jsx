import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()

  const [email, setEmail]     = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy]       = useState(false)

  const friendlyError = (code) => {
    const map = {
      'auth/user-not-found':  'NO ACCOUNT FOUND FOR THAT EMAIL.',
      'auth/invalid-email':   'INVALID EMAIL FORMAT.',
      'auth/too-many-requests': 'TOO MANY ATTEMPTS. TRY LATER.',
    }
    return map[code] || 'UNEXPECTED ERROR. TRY AGAIN.'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setBusy(true)
    try {
      await resetPassword(email)
      setSuccess(true)
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

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <Link
            to="/login"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: 'var(--text-dim)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--green)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            &#x25C4; BACK TO LOGIN
          </Link>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '13px', color: 'var(--green)', letterSpacing: '1px', lineHeight: 1.6 }}>
            RECOVER<br />ACCESS
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '18px', color: 'var(--text-dim)', marginTop: '10px', letterSpacing: '2px' }}>
            WE'LL SEND A RESET LINK TO YOUR EMAIL
          </div>
          <div style={{ width: '100%', height: '1px', background: 'var(--border)', marginTop: '20px' }} />
        </div>

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="msg-success" style={{ lineHeight: 1.6 }}>
              &#x25B6; RESET LINK SENT!<br />
              CHECK YOUR INBOX AND FOLLOW THE INSTRUCTIONS.
            </div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: '16px', color: 'var(--text-dim)', textAlign: 'center' }}>
              DIDN'T RECEIVE IT? CHECK YOUR SPAM FOLDER.
            </div>
            <button
              className="btn-pixel"
              style={{ width: '100%' }}
              onClick={() => { setSuccess(false); setEmail('') }}
            >
              SEND AGAIN
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

            {error && <div className="msg-error">&#x25B6; {error}</div>}

            <button className="btn-pixel" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'SENDING...' : 'SEND RESET LINK'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
