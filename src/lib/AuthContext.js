import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)
const SESSIONS_KEY = 'banqo_sessions'
const ACTIVE_CLIENT_KEY = 'banqo_active_client'

export function AuthProvider({ children }) {
  const [sessions, setSessions] = useState({})
  const [activeClient, setActiveClient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(SESSIONS_KEY)
    const active = localStorage.getItem(ACTIVE_CLIENT_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const valid = {}
      Object.entries(parsed).forEach(([key, s]) => {
        if (new Date(s.expiresAt) > new Date()) valid[key] = s
      })
      setSessions(valid)
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(valid))
      if (active && valid[active]) setActiveClient(active)
      else if (Object.keys(valid).length > 0) setActiveClient(Object.keys(valid)[0])
    }
    setLoading(false)
  }, [])

  function addSession(sessionData) {
    const key = sessionData.client.username
    setSessions(prev => {
      const updated = { ...prev, [key]: sessionData }
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated))
      return updated
    })
    setActiveClient(key)
    localStorage.setItem(ACTIVE_CLIENT_KEY, key)
  }

  function switchClient(username) {
    if (sessions[username]) {
      setActiveClient(username)
      localStorage.setItem(ACTIVE_CLIENT_KEY, username)
    }
  }

  function removeSession(username) {
    setSessions(prev => {
      const updated = { ...prev }
      delete updated[username]
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated))
      return updated
    })
    const remaining = Object.keys(sessions).filter(k => k !== username)
    if (remaining.length > 0) {
      setActiveClient(remaining[0])
      localStorage.setItem(ACTIVE_CLIENT_KEY, remaining[0])
    } else {
      setActiveClient(null)
      localStorage.removeItem(ACTIVE_CLIENT_KEY)
    }
  }

  function logout() {
    setSessions({})
    setActiveClient(null)
    localStorage.removeItem(SESSIONS_KEY)
    localStorage.removeItem(ACTIVE_CLIENT_KEY)
  }

  const session = activeClient ? sessions[activeClient] : null
  const canRead = session?.permission === 'read_send' || session?.permission === 'read_only'
  const canSend = session?.permission === 'read_send' || session?.permission === 'send_only'
  const sessionList = Object.values(sessions)

  return (
    <AuthContext.Provider value={{
      session, sessions, sessionList, activeClient,
      addSession, switchClient, removeSession, logout,
      loading, canRead, canSend
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
