import React, { useState } from 'react'

const FONT = "'Clarity City','DM Mono',sans-serif"
const MONO = "'DM Mono',monospace"
const BG = '#111114'
const CARD = '#1a1a1e'
const BORDER = '#252528'
const ADMIN_KEY = 'banqo_admin_auth'

export function isAdminAuthed() {
  return localStorage.getItem(ADMIN_KEY) === 'true'
}

export function adminLogout() {
  localStorage.removeItem(ADMIN_KEY)
  window.location.reload()
}

export default function AdminLogin({ onAuth }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  function handleLogin() {
    setLoading(true)
    setError('')
    setTimeout(() => {
      const correct = process.env.REACT_APP_ADMIN_PASSWORD
      if (password === correct) {
        localStorage.setItem(ADMIN_KEY, 'true')
        onAuth()
      } else {
        setError('Incorrect password')
        setPassword('')
      }
      setLoading(false)
    }, 400)
  }

  return (
    <div style={{ background: BG, minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily: FONT, color:'#fff', padding:24 }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:40 }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill={CARD}/>
            <path d="M8 12C8 10.3431 9.34315 9 11 9H25C26.6569 9 28 10.3431 28 12V20C28 21.6569 26.6569 23 25 23H20L15 27V23H11C9.34315 23 8 21.6569 8 20V12Z" fill="#F5C518"/>
          </svg>
          <div>
            <div style={{ fontSize:13, fontFamily: MONO, color:'#F5C518', letterSpacing:'0.2em' }}>BANQO</div>
            <div style={{ fontSize:11, fontFamily: MONO, color:'#888aa0', marginTop:2 }}>admin dashboard</div>
          </div>
        </div>

        <div style={{ fontSize:26, fontWeight:700, marginBottom:6 }}>Welcome back.</div>
        <div style={{ fontSize:14, color:'#888aa0', fontFamily: MONO, marginBottom:32 }}>Enter your admin password to continue.</div>

        <div style={{ background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:16, padding:20 }}>
          <div style={{ fontSize:10, fontFamily: MONO, color:'#888aa0', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>password</div>
          <div style={{ display:'flex', alignItems:'center', background: BG, border:`0.5px solid ${error ? '#e24b4a' : BORDER}`, borderRadius:10, padding:'10px 14px', marginBottom:error ? 8 : 16, gap:8 }}>
            <input
              type={show ? 'text' : 'password'}
              style={{ flex:1, background:'none', border:'none', outline:'none', color:'#fff', fontSize:15, fontFamily: FONT, fontWeight:200, caretColor:'#F5C518' }}
              placeholder="enter admin password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
            <button style={{ background:'none', border:'none', color:'#888aa0', cursor:'pointer', fontSize:13, fontFamily: MONO, padding:0 }}
              onClick={() => setShow(v => !v)}>
              {show ? 'hide' : 'show'}
            </button>
          </div>
          {error && <div style={{ fontSize:12, color:'#e24b4a', fontFamily: MONO, marginBottom:14, padding:'7px 10px', background:'#2a1414', borderRadius:7 }}>{error}</div>}
          <button
            style={{ width:'100%', padding:14, background:'#F5C518', border:'none', borderRadius:10, color:'#111114', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily: FONT, opacity: loading ? 0.6 : 1 }}
            onClick={handleLogin} disabled={loading}>
            {loading ? 'checking...' : 'sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
