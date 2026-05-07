import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export default function InboxScreen() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const myUsername = session.client.username

  useEffect(() => {
    loadConversations()
  }, [session])

  async function loadConversations() {
    try {
      // Find all shared conversations that involve this client's username
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .not('convo_key', 'is', null)
        .ilike('convo_key', `%${myUsername}%`)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (error) throw error

      // Extract the other person's username from the convo_key
      const convos = (data || []).map(c => {
        const parts = c.convo_key.split('::')
        const otherUsername = parts.find(p => p !== myUsername) || parts[0]
        return { ...c, otherUsername }
      })

      setConversations(convos)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function doSearch() {
      if (!search.trim()) { setSearchResults([]); return }
      setSearching(true)
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, username, full_name')
          .ilike('username', `%${search}%`)
          .eq('status', 'active')
          .neq('username', myUsername)
          .limit(8)

        if (error) throw error
        setSearchResults(data || [])
      } catch(e) {
        console.error(e)
      } finally {
        setSearching(false)
      }
    }
    const timer = setTimeout(doSearch, 300)
    return () => clearTimeout(timer)
  }, [search, session])

  const permLabel = { read_send:'read + send', read_only:'read only', send_only:'send only' }
  const initials = (name) => name ? name.slice(0, 2).toUpperCase() : '??'
  const avatarColors = [['#1e2d4a','#378add'],['#2d1e3a','#d4537e'],['#1e2e1e','#639922'],['#2a1e1e','#d85a30'],['#1e2535','#85b7eb']]
  const colorFor = (str) => avatarColors[(str || '').charCodeAt(0) % avatarColors.length]

  function timeAgo(ts) {
    if (!ts) return ''
    const diff = Date.now() - new Date(ts)
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return 'yesterday'
  }

  function openChat(username) {
    setShowSearch(false)
    setSearch('')
    setSearchResults([])
    navigate(`/chat/${username}`)
  }

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <div style={s.userPill}>
          <div style={s.avatar}>{initials(myUsername)}</div>
          <div>
            <div style={s.handle}>@{myUsername}</div>
            <div style={s.statusRow}>
              <div style={s.statusDot} />
              <span style={s.statusLabel}>online until 11pm ET</span>
            </div>
          </div>
        </div>
        <button style={s.iconBtn} onClick={() => setShowSearch(true)}>🔍</button>
      </div>

      <div style={s.userBanner}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={s.bannerLabel}>logged in as user ·</span>
          <span style={s.bannerName}>{session.user.full_name}</span>
        </div>
        <span style={s.permBadge}>{permLabel[session.permission]}</span>
      </div>

      {showSearch && (
        <div style={s.searchOverlay}>
          <div style={s.searchRow}>
            <div style={s.searchBar}>
              <span>🔍</span>
              <input
                autoFocus
                style={s.searchInput}
                placeholder="find a username..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button style={s.cancelBtn} onClick={() => { setShowSearch(false); setSearch(''); setSearchResults([]) }}>cancel</button>
          </div>

          <div style={s.searchResults}>
            {!search.trim() && <div style={s.searchHint}>start typing to find someone</div>}
            {searching && <div style={s.searchHint}>searching...</div>}
            {!searching && search.trim() && searchResults.length === 0 && (
              <div style={s.searchHint}>no users found for "{search}"</div>
            )}
            {searchResults.map((client, i) => {
              const [bg, fg] = colorFor(client.username)
              return (
                <div key={client.id} style={{ ...s.resultItem, animationDelay:`${i * 0.05}s` }}
                  onClick={() => openChat(client.username)}>
                  <div style={{ ...s.resultAvatar, background: bg, color: fg }}>
                    {initials(client.username)}
                  </div>
                  <div>
                    <div style={s.resultName}>{client.full_name}</div>
                    <div style={s.resultHandle}>@{client.username}</div>
                  </div>
                  <div style={s.onlineTag}>online</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!showSearch && (
        <>
          <div style={s.note}>
            <span>ℹ️</span>
            <span style={s.noteText}>These are <strong style={{color:'#888'}}>your threads</strong> — relay responses to your client.</span>
          </div>

          <div style={s.sectionLabel}>my conversations</div>

          <div style={s.list}>
            {loading && <div style={s.empty}>loading...</div>}
            {!loading && conversations.length === 0 && (
              <div style={s.empty}>
                {'no conversations yet.\n'}
                <span style={{ color:'#1d9e75', cursor:'pointer' }} onClick={() => setShowSearch(true)}>
                  tap 🔍 to find someone
                </span>
              </div>
            )}
            {conversations.map(convo => {
              const [bg, fg] = colorFor(convo.otherUsername)
              return (
                <div key={convo.id} style={s.convoItem} onClick={() => navigate(`/chat/${convo.otherUsername}`)}>
                  <div style={{ ...s.convoAvatar, background: bg, color: fg }}>
                    {initials(convo.otherUsername)}
                  </div>
                  <div style={s.convoInfo}>
                    <div style={s.convoName}>@{convo.otherUsername}</div>
                    <div style={s.convoPreview}>{convo.last_message || 'no messages yet'}</div>
                    <span style={s.threadTag}>your thread</span>
                  </div>
                  <div style={s.convoMeta}>
                    <div style={s.convoTime}>{timeAgo(convo.last_message_at)}</div>
                    {convo.unread_count > 0 && <div style={s.badge}>{convo.unread_count}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div style={s.bottomNav}>
        <button style={{...s.navBtn, color:'#1d9e75'}}>💬<span style={s.navLabel}>chats</span></button>
        <button style={s.navBtn}>🔔<span style={s.navLabel}>alerts</span></button>
        <button style={s.navBtn} onClick={logout}>↩<span style={s.navLabel}>logout</span></button>
      </div>
    </div>
  )
}

const s = {
  wrap: { background:'#0e0e10', minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:"'Syne',sans-serif", color:'#f0ede6', maxWidth:480, margin:'0 auto' },
  topBar: { padding:'14px 16px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'0.5px solid #2a2a2e', flexShrink:0 },
  userPill: { display:'flex', alignItems:'center', gap:8 },
  avatar: { width:34, height:34, borderRadius:'50%', background:'#1e6a4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600, color:'#5dcaa5' },
  handle: { fontSize:15, fontWeight:600 },
  statusRow: { display:'flex', alignItems:'center', gap:5 },
  statusDot: { width:7, height:7, borderRadius:'50%', background:'#1d9e75' },
  statusLabel: { fontSize:11, color:'#5dcaa5', fontFamily:"'DM Mono',monospace" },
  iconBtn: { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#888' },
  userBanner: { background:'#13201a', borderBottom:'0.5px solid #1d9e75', padding:'7px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  bannerLabel: { fontSize:10, fontFamily:"'DM Mono',monospace", color:'#0f6e56' },
  bannerName: { fontSize:10, fontFamily:"'DM Mono',monospace", color:'#5dcaa5', fontWeight:600 },
  permBadge: { fontSize:9, fontFamily:"'DM Mono',monospace", background:'#1d9e75', color:'#04342c', padding:'1px 7px', borderRadius:5 },
  searchOverlay: { flex:1, display:'flex', flexDirection:'column', background:'#0e0e10' },
  searchRow: { padding:'12px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:'0.5px solid #1e1e22' },
  searchBar: { flex:1, background:'#1a1a1e', border:'0.5px solid #1d9e75', borderRadius:10, display:'flex', alignItems:'center', gap:8, padding:'8px 12px' },
  searchInput: { background:'none', border:'none', outline:'none', color:'#f0ede6', fontSize:14, fontFamily:"'Syne',sans-serif", width:'100%' },
  cancelBtn: { background:'none', border:'none', color:'#1d9e75', fontSize:13, cursor:'pointer', fontFamily:"'Syne',sans-serif" },
  searchResults: { flex:1, padding:'8px 0', overflowY:'auto' },
  searchHint: { textAlign:'center', padding:'40px 16px', color:'#333', fontSize:12, fontFamily:"'DM Mono',monospace" },
  resultItem: { display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', borderBottom:'0.5px solid #161618' },
  resultAvatar: { width:44, height:44, borderRadius:'50%', fontSize:15, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  resultName: { fontSize:14, fontWeight:600 },
  resultHandle: { fontSize:12, color:'#555', fontFamily:"'DM Mono',monospace" },
  onlineTag: { marginLeft:'auto', fontSize:9, fontFamily:"'DM Mono',monospace", background:'#13201a', color:'#1d9e75', border:'0.5px solid #1d9e75', padding:'2px 7px', borderRadius:8 },
  note: { margin:'10px 16px', background:'#1a1a1e', border:'0.5px solid #2a2a2e', borderRadius:8, padding:'8px 12px', display:'flex', alignItems:'center', gap:7, flexShrink:0 },
  noteText: { fontSize:11, fontFamily:"'DM Mono',monospace", color:'#555', lineHeight:1.4 },
  sectionLabel: { fontSize:10, fontWeight:600, letterSpacing:'0.12em', color:'#444', textTransform:'uppercase', fontFamily:"'DM Mono',monospace", padding:'0 16px', marginBottom:6, flexShrink:0 },
  list: { flex:1, overflowY:'auto' },
  empty: { textAlign:'center', padding:'40px 16px', color:'#333', fontSize:12, fontFamily:"'DM Mono',monospace", lineHeight:2, whiteSpace:'pre-line' },
  convoItem: { display:'flex', alignItems:'center', gap:12, padding:'11px 16px', cursor:'pointer', borderBottom:'0.5px solid #161618' },
  convoAvatar: { width:42, height:42, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:600, flexShrink:0 },
  convoInfo: { flex:1, minWidth:0 },
  convoName: { fontSize:14, fontWeight:600, marginBottom:2 },
  convoPreview: { fontSize:12, color:'#555', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:"'DM Mono',monospace" },
  threadTag: { fontSize:9, fontFamily:"'DM Mono',monospace", color:'#1d9e75', background:'#13201a', border:'0.5px solid #1d9e75', padding:'1px 6px', borderRadius:4, marginTop:3, display:'inline-block' },
  convoMeta: { textAlign:'right', flexShrink:0 },
  convoTime: { fontSize:10, color:'#444', fontFamily:"'DM Mono',monospace", marginBottom:4 },
  badge: { background:'#1d9e75', color:'#04342c', fontSize:10, fontWeight:700, borderRadius:10, padding:'1px 6px', fontFamily:"'DM Mono',monospace", display:'inline-block' },
  bottomNav: { borderTop:'0.5px solid #1e1e22', display:'flex', padding:'10px 0 14px', flexShrink:0 },
  navBtn: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', color:'#444', fontSize:18 },
  navLabel: { fontSize:9, fontFamily:"'DM Mono',monospace" }
}
