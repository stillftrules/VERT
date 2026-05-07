import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginScreen from './components/auth/LoginScreen'
import InboxScreen from './pages/InboxScreen'
import ChatScreen from './pages/ChatScreen'
import AdminDashboard from './pages/AdminDashboard'

function AppRoutes() {
  const { session, loading } = useAuth()

  // Admin dashboard — always accessible at /admin, no auth code needed
  if (window.location.pathname.startsWith('/admin')) {
    return <AdminDashboard />
  }

  if (loading) return (
    <div style={{ background:'#0e0e10', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#1d9e75', fontFamily:'DM Mono, monospace', fontSize:13 }}>
      loading...
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/inbox" replace /> : <LoginScreen />} />
      <Route path="/inbox" element={session ? <InboxScreen /> : <Navigate to="/login" replace />} />
      <Route path="/chat/:contactUsername" element={session ? <ChatScreen /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={session ? '/inbox' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
