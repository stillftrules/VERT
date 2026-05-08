import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { GlowUsername } from './PublicLanding'

const FONT = "'Clarity City','DM Mono',sans-serif"
const MONO = "'DM Mono',monospace"
const BG     = '#111113'
const CARD   = '#1c1c1e'
const BORDER = '#2a2a2e'
const BLUE   = '#1d9bf0'
const GREEN  = '#7dd3a8'

// Compact client switcher row — shown at top of inbox
export function ClientStoriesRow({ sessions, activeClient, onSwitch, onEnterCode }) {
  const navigate = useNavigate()
  return (
    <div style={{ display:'flex', gap:12, overflowX:'auto', padding:'10px 16px', scrollbarWidth:'none', borderBottom:`0.5px solid ${BORDER}`, flexShrink:0 }}>
      {sessions.map(sess => {
        const isActive = activeClient === sess.client.username
        const isExpired = new Date(sess.expiresAt) < new Date()
        return (
          <div key={sess.client.username}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0, cursor: isExpired ? 'not-allowed' : 'pointer', opacity: isExpired ? 0.4 : 1 }}
            onClick={() => !isExpired && onSwitch(sess.client.username, navigate)}>
            <div style={{
              width:46, height:46, borderRadius:'50%',
              background: isActive ? '#0f2030' : '#2a2a2e',
              border: isActive ? `2px solid ${BLUE}` : '2px solid transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
              position:'relative'
            }}>
              <span style={{ color: isActive ? BLUE : '#aaa', fontSize:14, fontWeight:700, fontFamily: MONO }}>
                {sess.client.username.slice(0,2).toUpperCase()}
              </span>
              {isActive && <div style={{ position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:'50%', background: BLUE, border:`2px solid ${BG}` }} />}
            </div>
            <span style={{ fontSize:9, color: isActive ? BLUE : '#666', fontFamily: MONO, maxWidth:48, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              @{sess.client.username}
            </span>
          </div>
        )
      })}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0, cursor:'pointer' }} onClick={onEnterCode}>
        <div style={{ width:46, height:46, borderRadius:'50%', background:'transparent', border:`1.5px dashed ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:22, color:'#444', lineHeight:1 }}>+</span>
        </div>
        <span style={{ fontSize:9, color:'#444', fontFamily: MONO }}>add</span>
      </div>
    </div>
  )
}

// Avatar circle for conversation rows
function Avatar({ username }) {
  const colors = ['#1a3a5c','#1a3320','#2a1a3a','#3a1a1a','#1a2a3a']
  const i = username.charCodeAt(0) % colors.length
  return (
    <div style={{ width:48, height:48, borderRadius:'50%', background: colors[i], border:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ color:'#aaa', fontSize:16, fontWeight:700, fontFamily: MONO }}>
        {username.slice(0,2).toUpperCase()}
      </span>
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
  const permLabel = { read_send:'read + send', read_only:'read only', send_only:'send only' }

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
    <div style={{ background: BG, minHeight:'100vh', display:'flex', flexDirection:'column', color:'#fff', maxWidth:480, margin:'0 auto', fontFamily: FONT }}>
      <style>{`
        ::placeholder { color: rgba(136,138,160,0.35) !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top bar */}
      <div style={{ padding:'14px 16px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <span style={{ color: BLUE, fontSize:17, fontWeight:700, fontFamily: MONO }}>@{myUsername}</span>
          <div style={{ fontSize:11, color:'#666', fontFamily: MONO, marginTop:2 }}>{session.user.full_name} · {permLabel[session.permission]}</div>
        </div>
        <button style={{ background:'none', border:'none', cursor:'pointer', padding:6, color:'#888' }}
          onClick={() => setShowSearch(v => !v)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      </div>

      {/* Client switcher */}
      {sessionList.length > 0 && (
        <ClientStoriesRow sessions={sessionList} activeClient={myUsername} onSwitch={handleSwitch} onEnterCode={onEnterCode} />
      )}

      {/* Search */}
      {showSearch && (
        <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px 16px', display:'flex', gap:10, alignItems:'center', borderBottom:`0.5px solid ${BORDER}` }}>
            <div style={{ flex:1, background: CARD, borderRadius:10, display:'flex', alignItems:'center', gap:8, padding:'9px 12px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input autoFocus style={{ background:'none', border:'none', outline:'none', color:'#fff', fontSize:15, fontFamily: MONO, width:'100%' }}
                placeholder="search username..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button style={{ background:'none', border:'none', color: BLUE, fontSize:14, fontFamily: FONT, cursor:'pointer' }}
              onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]) }}>cancel</button>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {!search.trim() && <div style={{ textAlign:'center', padding:'48px 16px', color:'#444', fontSize:13, fontFamily: MONO }}>start typing to find someone</div>}
            {searching && <div style={{ textAlign:'center', padding:'48px 16px', color:'#444', fontSize:13, fontFamily: MONO }}>searching...</div>}
            {!searching && search.trim() && searchResults.length === 0 && <div style={{ textAlign:'center', padding:'48px 16px', color:'#444', fontSize:13, fontFamily: MONO }}>no users found</div>}
            {searchResults.map(client => (
              <div key={client.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', borderBottom:`0.5px solid ${BORDER}` }}
                onClick={() => openChat(client.username)}>
                <Avatar username={client.username} />
                <div>
                  <div style={{ color: BLUE, fontSize:15, fontWeight:600, fontFamily: MONO }}>@{client.username}</div>
                  <div style={{ fontSize:12, color:'#666', fontFamily: MONO, marginTop:2 }}>{client.full_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation list */}
      {!showSearch && (
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading && <div style={{ textAlign:'center', padding:'60px 16px', color:'#444', fontSize:13, fontFamily: MONO }}>loading...</div>}
          {!loading && conversations.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 16px', color:'#444', fontSize:13, fontFamily: MONO, lineHeight:2 }}>
              no conversations yet
              <div style={{ color: BLUE, cursor:'pointer', marginTop:8, fontSize:13 }} onClick={() => setShowSearch(true)}>tap search to start one →</div>
            </div>
          )}
          {conversations.map((convo, i) => (
            <div key={convo.id}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', borderBottom:`0.5px solid ${BORDER}` }}
              onClick={() => navigate(`/chat/${convo.otherUsername}`)}>
              <Avatar username={convo.otherUsername} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color: BLUE, fontSize:15, fontWeight:600, fontFamily: MONO }}>@{convo.otherUsername}</div>
                <div style={{ fontSize:13, color:'#666', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:3, fontFamily: MONO }}>
                  {convo.last_message || 'no messages yet'}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:11, color:'#555', fontFamily: MONO, marginBottom:4 }}>{timeAgo(convo.last_message_at)}</div>
                {convo.unread_count > 0 && (
                  <div style={{ background: BLUE, color:'#fff', fontSize:11, fontWeight:700, borderRadius:10, padding:'2px 7px', display:'inline-block', fontFamily: MONO }}>
                    {convo.unread_count}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ borderTop:`0.5px solid ${BORDER}`, display:'flex', padding:'10px 0 24px', flexShrink:0 }}>
        <button style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color: BLUE }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style={{ fontSize:10, fontFamily: MONO }}>chats</span>
        </button>
        <button style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:'#555' }} onClick={logout}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          <span style={{ fontSize:10, fontFamily: MONO }}>logout</span>
        </button>
      </div>
    </div>
  )
}
