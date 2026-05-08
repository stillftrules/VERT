import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { GlowUsername } from './PublicLanding'

export default function ClientSelector({ onAddClient }) {
  const { sessionList, activeClient, switchClient, logout } = useAuth()
  const navigate = useNavigate()

  const avatarColors = [
    ['#2a1f05','#F5C518'],['#1a1f2e','#85b7eb'],
    ['#1e2a1e','#5dcaa5'],['#2a1a1e','#d85a30'],
    ['#221a2e','#d4537e'],['#1a2535','#85b7eb']
  ]
  const colorFor = (str) => avatarColors[(str||'').charCodeAt(0) % avatarColors.length]
  const initials = (str) => str ? str.slice(0,2).toUpperCase() : '??'

  const permLabel = { read_send:'read + send', read_only:'read only', send_only:'send only' }

  function timeLeft(expiresAt) {
    const diff = new Date(expiresAt) - new Date()
    if (diff <= 0) return 'expired'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 0) return `${h}h ${m}m left`
    return `${m}m left`
  }

  function enterClient(session) {
    switchClient(session.client.username)
    navigate('/inbox')
  }

  const neu = {
    card: '8px 8px 16px #12141c, -4px -4px 10px #252528',
    btn: '6px 6px 12px #12141c, -3px -3px 8px #252528',
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.logoRow}>
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#1a1a1e"/>
            <path d="M8 12C8 10.3431 9.34315 9 11 9H25C26.6569 9 28 10.3431 28 12V20C28 21.6569 26.6569 23 25 23H20L15 27V23H11C9.34315 23 8 21.6569 8 20V12Z" fill="#F5C518"/>
          </svg>
          <span style={s.appName}>BANQO</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.userName}>{sessionList[0]?.user.full_name}</span>
          <button style={{ ...s.logoutBtn, boxShadow: neu.btn }} onClick={logout}>logout</button>
        </div>
      </div>

      <div style={s.body}>
        <div style={s.greeting}>
          <div style={s.greetLabel}>Good day,</div>
          <div style={s.greetName}>{sessionList[0]?.user.full_name?.split(' ')[0]}</div>
        </div>

        <div style={s.sectionLabel}>your clients today</div>

        {sessionList.map(session => {
          const [bg, fg] = colorFor(session.client.username)
          const isActive = activeClient === session.client.username
          return (
            <div key={session.client.username}
              style={{ ...s.clientCard, boxShadow: neu.card, ...(isActive ? s.clientCardActive : {}) }}
              onClick={() => enterClient(session)}>
              <div style={{ ...s.clientAvatar, background:bg, color:fg }}>
                {initials(session.client.username)}
              </div>
              <div style={s.clientInfo}>
                <div style={s.clientHandle}>@{session.client.username}</div>
                <div style={s.clientMeta}>
                  <span style={{ ...s.permBadge, ...(isActive ? s.permBadgeActive : {}) }}>
                    {permLabel[session.permission]}
                  </span>
                  <span style={s.timeLeft}>{timeLeft(session.expiresAt)}</span>
                </div>
              </div>
              <div style={{ ...s.enterArrow, color: isActive ? '#F5C518' : '#444' }}>→</div>
            </div>
          )
        })}

        <div style={{ ...s.addClientBtn, boxShadow: neu.card }} onClick={onAddClient}>
          <div style={s.addIcon}>+</div>
          <span style={s.addLabel}>enter another access code</span>
        </div>
      </div>
    </div>
  )
}

const s = {
  wrap: { background:'#111114', minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:"'Clarity City','DM Mono',sans-serif", color:'#ffffff', maxWidth:480, margin:'0 auto' },
  header: { padding:'20px 24px 16px', borderBottom:'0.5px solid #252528', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logoRow: { display:'flex', alignItems:'center', gap:10 },
  appName: { fontSize:20, fontWeight:700, color:'#ffffff', letterSpacing:'0.1em' },
  headerRight: { display:'flex', alignItems:'center', gap:12 },
  userName: { fontSize:13, color:'#888aa0', fontFamily:"'DM Mono',monospace" },
  placeholder: 'rgba(136,138,160,0.3)', logoutBtn: { background:'#1a1a1e', border:'0.5px solid #252528', color:'#888aa0', fontSize:12, fontFamily:"'DM Mono',monospace", padding:'5px 12px', borderRadius:8, cursor:'pointer' },
  body: { flex:1, padding:'28px 24px', display:'flex', flexDirection:'column', gap:14 },
  greeting: { marginBottom:8 },
  greetLabel: { fontSize:14, color:'#888aa0', fontFamily:"'DM Mono',monospace" },
  greetName: { fontSize:28, fontWeight:700, color:'#ffffff' },
  sectionLabel: { fontSize:11, fontWeight:600, letterSpacing:'0.14em', color:'#888aa0', textTransform:'uppercase', fontFamily:"'DM Mono',monospace", marginBottom:2 },
  clientCard: { background:'#1a1a1e', border:'0.5px solid #252528', borderRadius:16, padding:'18px 16px', display:'flex', alignItems:'center', gap:14, cursor:'pointer', transition:'all .15s' },
  clientCardActive: { border:'1px solid #F5C51860', background:'#24230f' },
  clientAvatar: { width:52, height:52, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, flexShrink:0 },
  clientInfo: { flex:1, minWidth:0 },
  clientHandle: { fontSize:18, fontWeight:700, marginBottom:6, color:'#ffffff' },
  clientMeta: { display:'flex', alignItems:'center', gap:10 },
  permBadge: { fontSize:11, fontFamily:"'DM Mono',monospace", background:'#252528', color:'#888aa0', padding:'3px 10px', borderRadius:6, border:'0.5px solid #3a3d4e' },
  permBadgeActive: { background:'#2a1f05', color:'#F5C518', border:'0.5px solid #F5C51840' },
  timeLeft: { fontSize:12, fontFamily:"'DM Mono',monospace", color:'#444' },
  enterArrow: { fontSize:22, flexShrink:0, transition:'color .15s' },
  addClientBtn: { background:'#1a1a1e', border:'0.5px dashed #252528', borderRadius:16, padding:'18px 16px', display:'flex', alignItems:'center', gap:14, cursor:'pointer', marginTop:4, transition:'all .15s' },
  addIcon: { width:40, height:40, borderRadius:12, background:'#252528', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#888aa0', flexShrink:0 },
  addLabel: { fontSize:16, color:'#888aa0', fontWeight:600 }
}
