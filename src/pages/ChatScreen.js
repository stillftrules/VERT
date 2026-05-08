import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { GlowUsername, UserUsername } from './PublicLanding'
import { ClientStoriesRow } from './InboxScreen'

const FONT = "'Clarity City','DM Mono',sans-serif"
const MONO = "'DM Mono',monospace"
const BG = '#111113'
const CARD = '#1c1c1e'
const BORDER = '#2a2a2e'
const BLUE   = '#1d9bf0'

export default function ChatScreen({ onEnterCode }) {
  const { contactUsername } = useParams()
  const { session, canSend, sessionList, switchClient } = useAuth()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [recording, setRecording] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

  const myUsername = session.client.username
  const otherUsername = contactUsername
  const convoKey = [myUsername, otherUsername].sort().join('::')

  useEffect(() => {
    async function init() {
      let { data: convo } = await supabase.from('conversations').select('*').eq('convo_key', convoKey).single()
      if (!convo) {
        const { data: newConvo, error } = await supabase.from('conversations')
          .insert({ client_id: session.client.id, user_id: null, contact_username: convoKey, convo_key: convoKey })
          .select().single()
        if (error) {
          const { data: retry } = await supabase.from('conversations').select('*').eq('convo_key', convoKey).single()
          convo = retry
        } else { convo = newConvo }
      }
      if (!convo) return
      setConversationId(convo.id)
      const { data: msgs } = await supabase.from('messages').select('*')
        .eq('conversation_id', convo.id).eq('is_deleted', false).order('created_at', { ascending: true })
      setMessages(msgs || [])
      if (channelRef.current) { await supabase.removeChannel(channelRef.current); channelRef.current = null }
      const channel = supabase.channel(`chat-${convo.id}-${Date.now()}`)
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`conversation_id=eq.${convo.id}` },
          (payload) => setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'messages', filter:`conversation_id=eq.${convo.id}` },
          (payload) => {
            if (payload.new.is_deleted) setMessages(prev => prev.filter(m => m.id !== payload.new.id))
            else setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
          })
      channel.subscribe()
      channelRef.current = channel
    }
    init()
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null } }
  }, [contactUsername, session])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  async function handleSend(isTranscribed = false) {
    if (!input.trim() || !canSend || !conversationId) return
    const content = input.trim(); setInput('')
    const { data: msg, error } = await supabase.from('messages').insert({
      conversation_id: conversationId, client_id: session.client.id,
      sender:'user', sent_by_user_id: session.user.id, content,
      is_transcribed: isTranscribed,
      meta: { from_username: myUsername, to_username: otherUsername }
    }).select().single()
    if (!error) {
      await supabase.from('conversations').update({ last_message: content, last_message_at: msg.created_at }).eq('id', conversationId)
      await supabase.from('audit_log').insert({ event_type:'message_sent', client_id: session.client.id, user_id: session.user.id, message_id: msg.id, meta: { from: myUsername, to: otherUsername, preview: content.slice(0,60) } })
    }
  }

  async function handleEdit(id) {
    await supabase.from('messages').update({ content: editContent, is_edited: true, edited_at: new Date().toISOString() }).eq('id', id)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: editContent, is_edited: true } : m))
    setEditingId(null)
  }

  async function handleDelete(id) {
    await supabase.from('messages').update({ is_deleted: true }).eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  function handleCopy(id, content) {
    navigator.clipboard?.writeText(content).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  function handleMic() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { alert('Voice input not supported. Try Chrome.'); return }
    if (recording) { setRecording(false); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1
    recognition.onstart = () => setRecording(true)
    recognition.onresult = (e) => { setInput(prev => prev ? prev + ' ' + e.results[0][0].transcript : e.results[0][0].transcript); setRecording(false) }
    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)
    recognition.start()
  }

  function isMine(msg) {
    if (msg.meta?.from_username) return msg.meta.from_username === myUsername
    return msg.client_id === session.client.id
  }

  function formatTime(ts) { return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) }

  function handleSwitch(username) {
    switchClient(username)
    navigate(`/chat/${contactUsername}`)
  }

  return (
    <div style={{ ...s.wrap, fontFamily: FONT }}>
      <style>{`::placeholder { color: rgba(136,138,160,0.3) !important; font-weight: 200 !important; }`}</style>

      {/* Sidebar overlay */}
      {showSidebar && (
        <div style={s.sideOverlay} onClick={() => setShowSidebar(false)}>
          <div style={s.sidebar} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'20px 16px 12px', borderBottom:`1px solid ${BORDER}` }}>
              <div style={{ fontSize:11, color:'#555', fontFamily: MONO, letterSpacing:'0.12em', textTransform:'uppercase' }}>switch client</div>
            </div>
            {sessionList.map(s2 => {
              const isActive = s2.client.username === myUsername
              const isExpired = new Date(s2.expiresAt) < new Date()
              return (
                <div key={s2.client.username}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                    background: isActive ? 'rgba(29,155,240,0.08)' : 'transparent',
                    borderLeft: isActive ? '3px solid #1d9bf0' : '3px solid transparent',
                    cursor: isExpired ? 'not-allowed' : 'pointer',
                    opacity: isExpired ? 0.4 : 1 }}
                  onClick={() => {
                    if (!isExpired) {
                      switchClient(s2.client.username)
                      setShowSidebar(false)
                      navigate(`/chat/${contactUsername}`)
                    }
                  }}>
                  <div style={{ width:36, height:36, borderRadius:10, background: isActive ? '#0f2030' : '#1a1c2e',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border: isActive ? '1.5px solid #1d9bf0' : `1px solid ${BORDER}` }}>
                    <span style={{ color: isActive ? '#1d9bf0' : '#888aa0', fontSize:13, fontWeight:700, fontFamily: MONO }}>
                      {s2.client.username.slice(0,2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div style={{ color: isActive ? '#1d9bf0' : '#ffffff', fontSize:14, fontWeight:600, fontFamily: MONO }}>
                      @{s2.client.username}
                    </div>
                    <div style={{ color:'#555', fontSize:11, fontFamily: MONO, marginTop:2 }}>
                      {isExpired ? 'expired' : s2.permission?.replace('_', ' ')}
                    </div>
                  </div>
                  {isActive && <div style={{ marginLeft:'auto', width:7, height:7, borderRadius:'50%', background:'#1d9bf0' }} />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/inbox')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={s.headerInfo}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily: MONO }}>
            <span style={{ color:'#1d9bf0', fontSize:15, fontWeight:700 }}>@{myUsername}</span>
            <span style={{ color:'#444', fontSize:15 }}>→</span>
            <span style={{ color:'#1d9bf0', fontSize:15, fontWeight:700 }}>@{otherUsername}</span>
          </div>
        </div>
        {sessionList.length > 1 && (
          <button style={s.sidebarBtn} onClick={() => setShowSidebar(v => !v)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="18" rx="1"/><path d="M14 7h7M14 12h7M14 17h7"/>
            </svg>
          </button>
        )}
      </div>

      <div style={s.messages}>
        {messages.length === 0 && <div style={{ ...s.noMessages, fontFamily: MONO }}>no messages yet — say hello!</div>}
        {messages.map(msg => {
          const mine = isMine(msg)
          const isCopied = copiedId === msg.id
          return (
            <div key={msg.id} style={{ ...s.msgRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth:'78%' }}>

                {editingId === msg.id ? (
                  <div style={s.editWrap}>
                    <input style={{ ...s.editInput, fontFamily: FONT }} value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEdit(msg.id)} autoFocus />
                    <button style={{ ...s.editSave, fontFamily: MONO }} onClick={() => handleEdit(msg.id)}>save</button>
                    <button style={{ ...s.editCancel, fontFamily: MONO }} onClick={() => setEditingId(null)}>cancel</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:6, flexDirection: mine ? 'row-reverse' : 'row' }}>
                    <div style={{ ...s.bubble, ...(mine ? s.bubbleMine : s.bubbleTheirs) }}
                      onDoubleClick={() => { if (mine) { setEditingId(msg.id); setEditContent(msg.content) } }}>
                      {msg.content}
                    </div>
                    {/* Copy button */}
                    <button style={s.copyBtn} onClick={() => handleCopy(msg.id, msg.content)} title="Copy message">
                      {isCopied ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      )}
                    </button>
                  </div>
                )}
                <div style={{ ...s.msgMeta, justifyContent: mine ? 'flex-end' : 'flex-start', fontFamily: MONO }}>
                  <span style={s.msgTime}>{formatTime(msg.created_at)}</span>
                  {msg.is_edited && <span style={s.msgEdited}>edited</span>}
                  {msg.is_transcribed && <span>🎤</span>}
                  {mine && !editingId && (
                    <>
                      <span style={s.actionLink} onClick={() => { setEditingId(msg.id); setEditContent(msg.content) }}>edit</span>
                      <span style={{ ...s.actionLink, color:'#e24b4a' }} onClick={() => handleDelete(msg.id)}>delete</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {canSend ? (
        <div style={s.inputRow}>
          <div style={s.inputWrap}>
            <textarea style={{ ...s.input, fontFamily: FONT }} placeholder="message..." value={input} rows={1}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} />
            {input.length > 0 && (
              <button style={s.clearBtn} onClick={() => setInput('')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#888aa0" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
            <button style={{ ...s.micBtn, color: recording ? '#e24b4a' : '#888aa0' }} onClick={handleMic}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7M12 17v4M8 21h8"/>
              </svg>
            </button>
          </div>
          <button style={s.sendBtn} onClick={() => handleSend()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111114" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>
          </button>
        </div>
      ) : (
        <div style={{ ...s.readOnlyBar, fontFamily: MONO }}>read only · you cannot send messages</div>
      )}
    </div>
  )
}

const s = {
  sideOverlay: { position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.6)', display:'flex' },
  sidebar: { width:220, height:'100%', background:'#0d0f1a', borderRight:`1px solid ${BORDER}`, display:'flex', flexDirection:'column', overflowY:'auto' },
  sidebarBtn: { marginLeft:'auto', background:'none', border:'none', color:'#888aa0', cursor:'pointer', padding:6, display:'flex', alignItems:'center' },
  wrap: { background: BG, minHeight:'100vh', display:'flex', flexDirection:'column', color:'#fff', maxWidth:480, margin:'0 auto' },
  header: { padding:'14px 20px 12px', borderBottom:`0.5px solid ${BORDER}`, display:'flex', alignItems:'center', gap:14, flexShrink:0 },
  backBtn: { background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', flexShrink:0 },
  headerInfo: { flex:1 },
  threadBanner: { background:'#1a1600', borderBottom:'0.5px solid #F5C51820', padding:'6px 20px', fontSize:11, color:'#F5C51880', flexShrink:0 },
  messages: { flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 },
  noMessages: { textAlign:'center', color:'#444', fontSize:13, marginTop:40 },
  msgRow: { display:'flex', gap:8, alignItems:'flex-end' },
  bubble: { padding:'11px 15px', borderRadius:18, fontSize:15, lineHeight:1.6, fontFamily: FONT },
  bubbleMine: { background:'#F5C518', color:'#111114', borderBottomRightRadius:4, fontWeight:500 },
  bubbleTheirs: { background: CARD, color:'#fff', border:`0.5px solid ${BORDER}`, borderBottomLeftRadius:4 },
  copyBtn: { background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', alignItems:'center', opacity:0.6, flexShrink:0, marginBottom:4 },
  msgMeta: { display:'flex', alignItems:'center', gap:8, marginTop:4, padding:'0 4px' },
  msgTime: { fontSize:10, color:'#444' },
  msgEdited: { fontSize:10, color:'#444' },
  actionLink: { fontSize:10, color:'#F5C518', cursor:'pointer' },
  editWrap: { display:'flex', gap:8, alignItems:'center' },
  editInput: { background: CARD, border:`1px solid #F5C518`, borderRadius:10, color:'#fff', padding:'8px 12px', fontSize:14, outline:'none', width:200 },
  editSave: { background:'#F5C518', border:'none', color:'#111114', fontSize:11, padding:'5px 12px', borderRadius:6, cursor:'pointer', fontWeight:600 },
  editCancel: { background:'none', border:'none', color:'#888aa0', fontSize:11, cursor:'pointer' },
  inputRow: { padding:'10px 16px 22px', borderTop:`0.5px solid ${BORDER}`, display:'flex', alignItems:'flex-end', gap:10, flexShrink:0 },
  inputWrap: { flex:1, background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:22, display:'flex', alignItems:'center', padding:'9px 14px', gap:8 },
  input: { flex:1, background:'none', border:'none', outline:'none', color:'#fff', fontSize:15, fontWeight:200, resize:'none', maxHeight:100, lineHeight:1.5, caretColor:'#F5C518' },
  clearBtn: { background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', padding:'0 2px', flexShrink:0 },
  micBtn: { background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', flexShrink:0 },
  sendBtn: { width:44, height:44, borderRadius:'50%', background:'#F5C518', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  readOnlyBar: { padding:'14px 20px', borderTop:`0.5px solid ${BORDER}`, textAlign:'center', fontSize:12, color:'#444', flexShrink:0 }
}
