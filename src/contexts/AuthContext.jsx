import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

const AuthContext = createContext(null)

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '20px',
      fontFamily: "'Press Start 2P', monospace",
    }}>
      <div style={{ fontSize: '18px', color: 'var(--green)', letterSpacing: '2px' }}>
        WEB<span style={{ color: 'var(--amber)' }}>TILE</span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '10px', height: '10px',
            background: 'var(--green)',
            animation: `blink 1s step-end ${i * 0.33}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => { setUser(u); setLoading(false) },
      (err) => { console.error('Auth error:', err); setLoading(false) }
    )
    return unsub
  }, [])

  const loginWithGoogle   = () => signInWithPopup(auth, googleProvider)
  const loginWithEmail    = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const registerWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password)
  const resetPassword     = (email) => sendPasswordResetEmail(auth, email)
  const logout            = () => signOut(auth)

  if (loading) return <LoadingScreen />

  return (
    <AuthContext.Provider value={{ user, loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
