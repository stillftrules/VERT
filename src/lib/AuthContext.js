import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const SESSION_KEY = 'vert_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session from localStorage
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Check if code is still valid (not expired)
      if (new Date(parsed.expiresAt) > new Date()) {
        setSession(parsed)
      } else {
        localStorage.removeItem(SESSION_KEY)
      }
    }
    setLoading(false)
  }, [])

  function login(sessionData) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
    setSession(sessionData)
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  // Auto-logout when code expires
  useEffect(() => {
    if (!session) return
    const msUntilExpiry = new Date(session.expiresAt) - new Date()
    if (msUntilExpiry <= 0) { logout(); return }
    const timer = setTimeout(logout, msUntilExpiry)
    return () => clearTimeout(timer)
  }, [session])

  const canRead = session?.permission === 'read_send' || session?.permission === 'read_only'
  const canSend = session?.permission === 'read_send' || session?.permission === 'send_only'

  return (
    <AuthContext.Provider value={{ session, login, logout, loading, canRead, canSend }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
