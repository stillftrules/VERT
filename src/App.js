import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginScreen from './components/auth/LoginScreen'
import ClientSelector from './pages/ClientSelector'
import InboxScreen from './pages/InboxScreen'
import ChatScreen from './pages/ChatScreen'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin, { isAdminAuthed } from './components/AdminLogin'
import PublicLanding from './pages/PublicLanding'
import PWAInstallPrompt from './components/PWAInstallPrompt'

function AppRoutes() {
  const { session, sessionList, loading } = useAuth()
  const [showLogin, setShowLogin] = useState(false)

  const [adminAuthed, setAdminAuthed] = React.useState(isAdminAuthed())
  if (window.location.pathname.startsWith('/admin')) {
    if (!adminAuthed) return <AdminLogin onAuth={() => setAdminAuthed(true)} />
    return <AdminDashboard />
  }

  if (loading) return (
    <div style={{ background:'#181922', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <svg width="48" height="48" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="10" fill="#22242f"/>
          <path d="M8 12C8 10.3431 9.34315 9 11 9H25C26.6569 9 28 10.3431 28 12V20C28 21.6569 26.6569 23 25 23H20L15 27V23H11C9.34315 23 8 21.6569 8 20V12Z" fill="#F5C518"/>
        </svg>
        <span style={{ color:'#F5C518', fontFamily:'DM Mono, monospace', fontSize:14, letterSpacing:'0.1em' }}>loading...</span>
      </div>
    </div>
  )

  // Show login screen when explicitly requested
  if (showLogin) {
    return <LoginScreen onSuccess={() => setShowLogin(false)} onGoBack={sessionList.length === 0 ? () => setShowLogin(false) : null} />
  }

  // No sessions — show public landing
  if (sessionList.length === 0) {
    return <PublicLanding onEnterCode={() => setShowLogin(true)} />
  }

  return (
    <Routes>
      <Route path="/select" element={<ClientSelector onAddClient={() => setShowLogin(true)} />} />
      <Route path="/inbox" element={session ? <InboxScreen onEnterCode={() => setShowLogin(true)} /> : <Navigate to="/select" replace />} />
      <Route path="/chat/:contactUsername" element={session ? <ChatScreen onEnterCode={() => setShowLogin(true)} /> : <Navigate to="/select" replace />} />
      <Route path="*" element={<Navigate to={session ? '/inbox' : '/select'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <PWAInstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  )
}
