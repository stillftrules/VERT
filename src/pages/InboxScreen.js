import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const FONT = "'Clarity City','DM Mono',sans-serif"
const MONO = "'DM Mono',monospace"
const BG     = '#161618'
const BORDER = '#2a2a2e'
const BLUE   = '#1d9bf0'

// Gunmetal tinted glass panel
const GLASS = {
  background: 'rgba(36,36,40,0.82)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `0.5px solid rgba(255,255,255,0.07)`,
  borderRadius: 16,
}

// Glowing client username — animated pulse
export function GlowClient({ username, size = 16 }) {
  return (
    <>
      <style>{`
        @keyframes clientPulse {
          0%,100% { text-shadow: 0 0 6px rgba(29,155,240,0.5), 0 0 14px rgba(29,155,240,0.2); opacity:1; }
          50% { text-shadow: 0 0 14px rgba(29,155,240,1), 0 0 32px rgba(29,155,240,0.6), 0 0 60px rgba(29,155,240,0.2); opacity:0.85; }
        }
        .client-glow { animation: clientPulse 3s ease-in-out infinite; color: #1d9bf0; font-family: 'DM Mono', monospace; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
      `}</style>
      <span className="client-glow" style={{ fontSize: size }}>@{username}</span>
    </>
  )
}

// Client switcher — text only, no circles
export function ClientStoriesRow({ sessions, activeClient, onSwitch, onEnterCode }) {
  const navigate = useNavigate()
  return (
    <div style={{ ...GLASS, display:'flex', gap:8, overflowX:'auto', padding:'12px 16px', scrollbarWidth:'none', flexShrink:0, alignItems:'center' }}>
      <style>{`
        @keyframes clientPulse {
          0%,100% { text-shadow: 0 0 6px rgba(29,155,240,0.5), 0 0 14px rgba(29,155,240,0.2); }
          50% { text-shadow: 0 0 14px rgba(29,155,240,1), 0 0 32px rgba(29,155,240,0.6); }
        }
        @keyframes activePulse {
          0%,100% { box-shadow: 0 0 0 1.5px rgba(29,155,240,0.6); }
          50% { box-shadow: 0 0 0 2.5px rgba(29,155,240,1), 0 0 12px rgba(29,155,240,0.4); }
        }
      `}</style>
      {sessions.map(sess => {
        const isActive = activeClient === sess.client.username
        const isExpired = new Date(sess.expiresAt) < new Date()
        return (
          <button key={sess.client.username}
            onClick={() => !isExpired && onSwitch(sess.client.username, navigate)}
            style={{
              background: isActive ? 'rgba(29,155,240,0.10)' : 'rgba(36,36,40,0.6)',
              border: isActive ? '1px solid rgba(29,155,240,0.45)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 22,
              padding: '12px 18px',
              color: isActive ? BLUE : '#555',
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: isActive ? 800 : 400,
              cursor: isExpired ? 'not-allowed' : 'pointer',
              opacity: isExpired ? 0.4 : 1,
              letterSpacing: '0.06em',
              animation: isActive ? 'activePulse 2.5s ease-in-out infinite' : 'none',
              flexShrink: 0,
              textTransform: 'uppercase',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}>
            {isActive
              ? <span style={{ animation:'clientPulse 3s ease-in-out infinite', color: BLUE, fontWeight:800, letterSpacing:'0.06em' }}>@{sess.client.username}</span>
              : <span style={{ color:'#555' }}>@{sess.client.username}</span>
            }
          </button>
        )
      })}
      <button onClick={onEnterCode} style={{ background:'transparent', border:`1px dashed ${BORDER}`, borderRadius:20, padding:'6px 14px', color:'#444', fontFamily: MONO, fontSize:12, cursor:'pointer', flexShrink:0 }}>
        + add
      </button>
    </div>
  )
}

export default function InboxScreen({ onEnterCode }) {
  const { session, sessionList, switchClient, logout } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const myUsername = session.client.username

  useEffect(() => { loadConversations() }, [session])

  async function loadConversations() {
    setLoading(true)
    try {
      const { data } = await supabase.from('conversations').select('*')
        .not('convo_key', 'is', null).ilike('convo_key', `%${myUsername}%`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
      const convos = (data || []).map(c => {
        const parts = c.convo_key.split('::')
        const otherUsername = parts.find(p => p !== myUsername) || parts[0]
        return { ...c, otherUsername }
      })
      setConversations(convos)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => {
    async function doSearch() {
      if (!search.trim()) { setSearchResults([]); return }
      setSearching(true)
      try {
        const { data } = await supabase.from('clients').select('id, username, full_name')
          .ilike('username', `%${search}%`).eq('status', 'active').neq('username', myUsername).limit(8)
        setSearchResults(data || [])
      } catch(e) { console.error(e) }
      setSearching(false)
    }
    const t = setTimeout(doSearch, 300)
    return () => clearTimeout(t)
  }, [search, session])

  function timeAgo(ts) {
    if (!ts) return ''
    const diff = Date.now() - new Date(ts)
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'now'
    if (m < 60) return `${m}m`
    if (m < 1440) return `${Math.floor(m/60)}h`
    return new Date(ts).toLocaleDateString('en-US', { month:'numeric', day:'numeric' })
  }

  function openChat(username) {
    setShowSearch(false); setSearch(''); setSearchResults([])
    navigate(`/chat/${username}`)
  }

  function handleSwitch(username, nav) {
    switchClient(username)
    nav('/inbox')
  }

  return (
    <div style={{ background:'transparent', minHeight:'100vh', display:'flex', flexDirection:'column', color:'#fff', width:'100%', fontFamily: FONT, padding:'12px 10px 0', gap:8, boxSizing:'border-box' }}>
      <style>{`
        ::placeholder { color: rgba(255,255,255,0.2) !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top bar */}
      <div style={{ ...GLASS, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontSize:22, fontWeight:800, color:'#ffffff', fontFamily: FONT, letterSpacing:'0.02em' }}>
          {session.user.full_name}
        </div>
        <button style={{ background:'none', border:'none', cursor:'pointer', padding:6, color:'#555' }}
          onClick={() => setShowSearch(v => !v)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      </div>

      {/* Client switcher pills */}
      {sessionList.length > 0 && (
        <ClientStoriesRow sessions={sessionList} activeClient={myUsername} onSwitch={handleSwitch} onEnterCode={onEnterCode} />
      )}

      {/* Search overlay */}
      {showSearch && (
        <div style={{ ...GLASS, flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', display:'flex', gap:10, alignItems:'center', borderBottom:`0.5px solid ${BORDER}` }}>
            <div style={{ flex:1, ...GLASS, display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderRadius:12 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input autoFocus style={{ background:'none', border:'none', outline:'none', color:'#fff', fontSize:15, fontFamily: MONO, width:'100%' }}
                placeholder="search username..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button style={{ background:'none', border:'none', color: BLUE, fontSize:13, fontFamily: MONO, cursor:'pointer' }}
              onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]) }}>cancel</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'8px 16px', display:'flex', flexDirection:'column', gap:8, paddingTop:12 }}>
            {!search.trim() && <div style={{ textAlign:'center', padding:'40px 0', color:'#444', fontSize:13, fontFamily: MONO }}>start typing to find someone</div>}
            {searching && <div style={{ textAlign:'center', padding:'40px 0', color:'#444', fontSize:13, fontFamily: MONO }}>searching...</div>}
            {!searching && search.trim() && searchResults.length === 0 && <div style={{ textAlign:'center', padding:'40px 0', color:'#444', fontSize:13, fontFamily: MONO }}>no users found</div>}
            {searchResults.map(client => (
              <div key={client.id} style={{ ...GLASS, padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}
                onClick={() => openChat(client.username)}>
                <GlowClient username={client.username} size={15} />
                <span style={{ fontSize:11, color:'#555', fontFamily: MONO }}>{client.full_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation list */}
      {!showSearch && (
        <div style={{ ...GLASS, flex:1, overflowY:'auto', padding:'12px 12px', display:'flex', flexDirection:'column', gap:8 }}>
          {loading && <div style={{ textAlign:'center', padding:'60px 0', color:'#444', fontSize:13, fontFamily: MONO }}>loading...</div>}
          {!loading && conversations.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#444', fontSize:13, fontFamily: MONO, lineHeight:2 }}>
              no conversations yet
              <div style={{ color: BLUE, cursor:'pointer', marginTop:8 }} onClick={() => setShowSearch(true)}>tap search to start one →</div>
            </div>
          )}
          {conversations.map(convo => (
            <div key={convo.id} style={{ ...GLASS, padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}
              onClick={() => navigate(`/chat/${convo.otherUsername}`)}>
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ color: '#ffffff', fontSize:15, fontWeight:700, fontFamily: MONO, textTransform:'uppercase', letterSpacing:'0.04em' }}>@{convo.otherUsername}</span>
                <div style={{ fontSize:12, color:'#555', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:5, fontFamily: MONO }}>
                  {convo.last_message || 'no messages yet'}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:10, color:'#444', fontFamily: MONO, marginBottom:4 }}>{timeAgo(convo.last_message_at)}</div>
                {convo.unread_count > 0 && (
                  <div style={{ background: BLUE, color:'#fff', fontSize:10, fontWeight:700, borderRadius:10, padding:'2px 8px', fontFamily: MONO }}>
                    {convo.unread_count}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ ...GLASS, display:'flex', justifyContent:'center', gap:56, padding:'10px 0 20px', flexShrink:0, marginBottom:12 }}>
        <button style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color: BLUE }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style={{ fontSize:10, fontFamily: MONO }}>chats</span>
        </button>
        <button style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:'#777' }} onClick={logout}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span style={{ fontSize:10, fontFamily: MONO }}>home</span>
        </button>
      </div>
    </div>
  )
}
