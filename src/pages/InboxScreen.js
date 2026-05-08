import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { GlowUsername } from './PublicLanding'

const FONT = "'Clarity City','DM Mono',sans-serif"
const MONO = "'DM Mono',monospace"
const BG = '#111114'
const CARD = '#1a1a1e'
const BORDER = '#252528'

// Stories-style client row
export function ClientStoriesRow({ sessions, activeClient, onSwitch, onEnterCode }) {
  const navigate = useNavigate()
  return (
    <div style={s.storiesWrap}>
      <style>{`
        @keyframes amberPulse {
          0%,100% { box-shadow: 0 0 0 2px rgba(245,197,24,0.4), 0 0 8px rgba(245,197,24,0.2); }
          50% { box-shadow: 0 0 0 2px rgba(245,197,24,0.9), 0 0 16px rgba(245,197,24,0.5), 0 0 28px rgba(245,197,24,0.2); }
        }
        @keyframes greyPulse {
          0%,100% { box-shadow: 0 0 0 2px rgba(80,80,80,0.4); }
          50% { box-shadow: 0 0 0 2px rgba(80,80,80,0.7); }
        }
      `}</style>
      <div style={s.storiesScroll}>
        {sessions.map(session => {
          const isActive = activeClient === session.client.username
          const isExpired = new Date(session.expiresAt) < new Date()
          return (
            <div key={session.client.username} style={s.storyItem}
              onClick={() => !isExpired && onSwitch(session.client.username, navigate)}>
              <div style={{
                ...s.storyCircle,
                animation: isExpired ? 'greyPulse 3s ease-in-out infinite' : 'amberPulse 2.5s ease-in-out infinite',
                opacity: isExpired ? 0.4 : 1,
                cursor: isExpired ? 'not-allowed' : 'pointer',
                background: isActive ? '#2a1f05' : CARD,
              }}>
                <span style={{ ...s.storyInitials, color: isExpired ? '#555' : '#F5C518' }}>
                  {session.client.username.slice(0,2).toUpperCase()}
                </span>
                {isActive && <div style={s.activeIndicator} />}
              </div>
              <div style={{ ...s.storyUsername, color: isExpired ? '#444' : isActive ? '#F5C518' : '#888aa0', fontFamily: MONO }}>
                @{session.client.username}
              </div>
            </div>
          )
        })}
        {/* Add code button */}
        <div style={s.storyItem} onClick={onEnterCode}>
          <div style={{ ...s.storyCircle, background: CARD, border:`1.5px dashed ${BORDER}`, animation:'none', boxShadow:'none' }}>
            <span style={{ fontSize:22, color:'#444' }}>+</span>
          </div>
          <div style={{ ...s.storyUsername, color:'#444', fontFamily: MONO }}>add code</div>
        </div>
      </div>
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
    const timer = setTimeout(doSearch, 300)
    return () => clearTimeout(timer)
  }, [search, session])

  const permLabel = { read_send:'read + send', read_only:'read only', send_only:'send only' }

  function timeAgo(ts) {
    if (!ts) return ''
    const diff = Date.now() - new Date(ts)
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m`
    if (m < 1440) return `${Math.floor(m/60)}h`
    return 'yesterday'
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
    <div style={{ ...s.wrap, fontFamily: FONT }}>
      <style>{`::placeholder { color: rgba(136,138,160,0.3) !important; font-weight: 200 !important; }`}</style>

      <div style={s.topBar}>
        <div>
          <GlowUsername username={myUsername} size={18} />
          <div style={{ ...s.subHandle, fontFamily: MONO }}>{session.user.full_name} · {permLabel[session.permission]}</div>
        </div>
        <button style={s.searchIconBtn} onClick={() => setShowSearch(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888aa0" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </button>
      </div>

      {/* Stories row - always visible when multiple clients */}
      {sessionList.length > 0 && (
        <ClientStoriesRow
          sessions={sessionList}
          activeClient={myUsername}
          onSwitch={handleSwitch}
          onEnterCode={onEnterCode}
        />
      )}

      {showSearch && (
        <div style={s.searchOverlay}>
          <div style={s.searchRow}>
            <div style={s.searchBar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input autoFocus style={{ ...s.searchInput, fontFamily: MONO }} placeholder="find a username..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button style={{ ...s.cancelBtn, fontFamily: FONT }} onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]) }}>cancel</button>
          </div>
          <div style={s.searchResults}>
            {!search.trim() && <div style={{ ...s.searchHint, fontFamily: MONO }}>start typing to find someone</div>}
            {searching && <div style={{ ...s.searchHint, fontFamily: MONO }}>searching...</div>}
            {!searching && search.trim() && searchResults.length === 0 && <div style={{ ...s.searchHint, fontFamily: MONO }}>no users found</div>}
            {searchResults.map(client => (
              <div key={client.id} style={s.resultItem} onClick={() => openChat(client.username)}>
                <GlowUsername username={client.username} size={16} />
                <div style={{ ...s.resultSub, fontFamily: MONO }}>{client.full_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showSearch && (
        <>
          <div style={{ ...s.sectionLabel, fontFamily: MONO }}>conversations</div>
          <div style={s.list}>
            {loading && <div style={{ ...s.empty, fontFamily: MONO }}>loading...</div>}
            {!loading && conversations.length === 0 && (
              <div style={{ ...s.empty, fontFamily: MONO }}>
                no conversations yet
                <div style={{ color:'#F5C518', cursor:'pointer', marginTop:8, fontSize:13 }} onClick={() => setShowSearch(true)}>tap search to find someone →</div>
              </div>
            )}
            {conversations.map(convo => (
              <div key={convo.id} style={s.convoItem} onClick={() => navigate(`/chat/${convo.otherUsername}`)}>
                <div style={s.convoInfo}>
                  <GlowUsername username={convo.otherUsername} size={17} />
                  <div style={{ ...s.convoPreview, fontFamily: MONO }}>{convo.last_message || 'no messages yet'}</div>
                </div>
                <div style={s.convoMeta}>
                  <div style={{ ...s.convoTime, fontFamily: MONO }}>{timeAgo(convo.last_message_at)}</div>
                  {convo.unread_count > 0 && <div style={s.badge}>{convo.unread_count}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={s.bottomNav}>
        <button style={{ ...s.navBtn, color:'#F5C518' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style={{ ...s.navLabel, fontFamily: MONO }}>chats</span>
        </button>
        <button style={s.navBtn} onClick={logout}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888aa0" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          <span style={{ ...s.navLabel, fontFamily: MONO }}>logout</span>
        </button>
      </div>
    </div>
  )
}

const s = {
  wrap: { background: BG, minHeight:'100vh', display:'flex', flexDirection:'column', color:'#fff', maxWidth:480, margin:'0 auto' },
  topBar: { padding:'16px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`0.5px solid ${BORDER}`, flexShrink:0 },
  subHandle: { fontSize:12, color:'#888aa0', marginTop:3 },
  searchIconBtn: { background:'none', border:'none', cursor:'pointer', padding:4, display:'flex' },
  storiesWrap: { borderBottom:`0.5px solid ${BORDER}`, padding:'12px 0', flexShrink:0 },
  storiesScroll: { display:'flex', gap:16, overflowX:'auto', paddingLeft:20, paddingRight:20, scrollbarWidth:'none' },
  storyItem: { display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer', flexShrink:0 },
  storyCircle: { width:56, height:56, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', transition:'all .2s' },
  storyInitials: { fontSize:16, fontWeight:700, fontFamily: MONO },
  activeIndicator: { position:'absolute', bottom:0, right:0, width:14, height:14, borderRadius:'50%', background:'#F5C518', border:`2px solid ${BG}` },
  storyUsername: { fontSize:10, maxWidth:64, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  searchOverlay: { flex:1, display:'flex', flexDirection:'column', background: BG },
  searchRow: { padding:'14px 20px', display:'flex', alignItems:'center', gap:10, borderBottom:`0.5px solid ${BORDER}` },
  searchBar: { flex:1, background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:12, display:'flex', alignItems:'center', gap:10, padding:'10px 14px' },
  searchInput: { background:'none', border:'none', outline:'none', color:'#fff', fontSize:15, width:'100%' },
  cancelBtn: { background:'none', border:'none', color:'#F5C518', fontSize:14, cursor:'pointer', whiteSpace:'nowrap' },
  searchResults: { flex:1, padding:'8px 0', overflowY:'auto' },
  searchHint: { textAlign:'center', padding:'40px 16px', color:'#444', fontSize:13 },
  resultItem: { display:'flex', flexDirection:'column', padding:'14px 20px', cursor:'pointer', borderBottom:`0.5px solid #161618`, gap:4 },
  resultSub: { fontSize:12, color:'#555' },
  sectionLabel: { fontSize:11, fontWeight:600, letterSpacing:'0.14em', color:'#888aa0', textTransform:'uppercase', padding:'16px 20px 10px', flexShrink:0 },
  list: { flex:1, overflowY:'auto', padding:'0 20px', display:'flex', flexDirection:'column', gap:12, paddingBottom:20 },
  empty: { textAlign:'center', padding:'60px 16px', color:'#444', fontSize:13, lineHeight:2 },
  convoItem: { background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:16, padding:'16px', display:'flex', alignItems:'center', gap:14, cursor:'pointer' },
  convoInfo: { flex:1, minWidth:0 },
  convoPreview: { fontSize:13, color:'#888aa0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:4 },
  convoMeta: { textAlign:'right', flexShrink:0 },
  convoTime: { fontSize:11, color:'#444', marginBottom:4 },
  badge: { background:'#F5C518', color:'#111114', fontSize:11, fontWeight:700, borderRadius:10, padding:'2px 8px', display:'inline-block' },
  bottomNav: { borderTop:`0.5px solid ${BORDER}`, display:'flex', padding:'12px 0 20px', flexShrink:0 },
  navBtn: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', color:'#888aa0' },
  navLabel: { fontSize:11 }
}
