import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { GlowClient, ClientStoriesRow } from './InboxScreen'

const FONT = "'Clarity City','DM Mono',sans-serif"
const MONO = "'DM Mono',monospace"
const BG     = '#161618'
const CARD   = 'rgba(36,36,40,0.82)'
const BORDER = '#2a2a2e'
const BLUE   = '#1d9bf0'

const GLASS = {
  background: 'rgba(36,36,40,0.82)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 20,
}

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
      setCopiedId(id); setTimeout(() => setCopiedId(null), 1500)
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

  return (
    <div style={{ background:'transparent', minHeight:'100vh', display:'flex', flexDirection:'column', color:'#fff', width:'100%', fontFamily: FONT, padding:'12px 10px 0', gap:8, boxSizing:'border-box' }}>
      <style>{`
        ::placeholder { color: rgba(255,255,255,0.2) !important; }
        ::-webkit-scrollbar { display: none; }
        @keyframes senderPulse {
          0%,100% { text-shadow: 0 0 6px rgba(29,155,240,0.5); opacity:1; }
          50% { text-shadow: 0 0 16px rgba(29,155,240,1), 0 0 40px rgba(29,155,240,0.4); opacity:0.8; }
        }
        @keyframes receiverGlow {
          0%,100% { text-shadow: 0 0 6px rgba(96,200,120,0.4); }
          50% { text-shadow: 0 0 14px rgba(96,200,120,0.9), 0 0 32px rgba(96,200,120,0.3); }
        }
      `}</style>

      {/* Sidebar */}
      {showSidebar && (
        <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.7)', display:'flex' }}
          onClick={() => setShowSidebar(false)}>
          <div style={{ width:200, height:'100%', ...GLASS, borderRadius:0, borderRight:`0.5px solid ${BORDER}`, display:'flex', flexDirection:'column', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'20px 16px 10px', fontSize:10, color:'#444', fontFamily: MONO, letterSpacing:'0.12em', textTransform:'uppercase' }}>switch client</div>
            {sessionList.map(s2 => {
              const isActive = s2.client.username === myUsername
              const isExpired = new Date(s2.expiresAt) < new Date()
              return (
                <div key={s2.client.username}
                  style={{ padding:'12px 16px', borderLeft: isActive ? `2px solid ${BLUE}` : '2px solid transparent',
                    background: isActive ? 'rgba(29,155,240,0.08)' : 'transparent',
                    cursor: isExpired ? 'not-allowed' : 'pointer', opacity: isExpired ? 0.4 : 1 }}
                  onClick={() => { if (!isExpired) { switchClient(s2.client.username); setShowSidebar(false); navigate(`/chat/${contactUsername}`) } }}>
                  <div style={{ color: isActive ? BLUE : '#aaa', fontSize:13, fontWeight:700, fontFamily: MONO, textTransform:'uppercase' }}>
                    @{s2.client.username}
                  </div>
                  <div style={{ color:'#444', fontSize:10, fontFamily: MONO, marginTop:2 }}>
                    {isExpired ? 'expired' : s2.permission?.replace('_',' ')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Back button — its own block */}
      <div style={{ ...GLASS, padding:'10px 16px', display:'flex', alignItems:'center', flexShrink:0 }}>
        <button style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color:'#888', padding:0 }}
          onClick={() => navigate('/inbox')}>
          {/* Chevron left — distinct from the → arrow between usernames */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span style={{ fontSize:12, fontFamily: MONO, color:'#666', letterSpacing:'0.06em' }}>BACK</span>
        </button>
        {sessionList.length > 1 && (
          <button style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#555', padding:4 }}
            onClick={() => setShowSidebar(v => !v)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Username header — centered, animated data flow */}
      <div style={{ ...GLASS, padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'center', gap:0, flexShrink:0 }}>
        <style>{`
          @keyframes dot1 { 0%,100%{opacity:0;transform:translateX(0)} 20%{opacity:1} 60%{opacity:0;transform:translateX(18px)} }
          @keyframes dot2 { 0%,100%{opacity:0;transform:translateX(0)} 35%{opacity:1} 75%{opacity:0;transform:translateX(18px)} }
          @keyframes dot3 { 0%,100%{opacity:0;transform:translateX(0)} 50%{opacity:1} 90%{opacity:0;transform:translateX(18px)} }
        `}</style>
        {/* Sender — glowing blue */}
        <span style={{ fontSize:17, fontWeight:800, fontFamily: MONO, textTransform:'uppercase', letterSpacing:'0.06em', animation:'senderPulse 3s ease-in-out infinite', color: BLUE, flexShrink:0 }}>
          @{myUsername}
        </span>
        {/* Animated data flow dots */}
        <div style={{ display:'flex', alignItems:'center', gap:5, margin:'0 24px', position:'relative', width:60 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background: BLUE, position:'absolute', left:0, animation:'dot1 1.6s ease-in-out infinite' }} />
          <span style={{ width:6, height:6, borderRadius:'50%', background: BLUE, position:'absolute', left:0, animation:'dot2 1.6s ease-in-out infinite' }} />
          <span style={{ width:6, height:6, borderRadius:'50%', background: BLUE, position:'absolute', left:0, animation:'dot3 1.6s ease-in-out infinite' }} />
        </div>
        {/* Receiver — plain white, no glow */}
        <span style={{ fontSize:17, fontWeight:800, fontFamily: MONO, textTransform:'uppercase', letterSpacing:'0.06em', color:'#ffffff', flexShrink:0 }}>
          @{otherUsername}
        </span>
      </div>

      {/* Messages */}
      <div style={{ ...GLASS, flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:10 }}>
        {messages.length === 0 && <div style={{ textAlign:'center', color:'#444', fontSize:13, marginTop:40, fontFamily: MONO }}>no messages yet — say hello!</div>}
        {messages.map(msg => {
          const mine = isMine(msg)
          const isCopied = copiedId === msg.id
          // Bubble color matches the sender's username color
          const bubbleColor = mine ? 'rgba(29,155,240,0.25)' : 'rgba(180,180,200,0.12)'
          const textColor = '#ffffff'
          return (
            <div key={msg.id} style={{ display:'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth:'76%' }}>
                {editingId === msg.id ? (
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input style={{ background:'rgba(36,36,40,0.9)', border:`1px solid ${BLUE}`, borderRadius:10, color:'#fff', padding:'8px 12px', fontSize:14, outline:'none', width:180, fontFamily: MONO }}
                      value={editContent} onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEdit(msg.id)} autoFocus />
                    <button style={{ background: BLUE, border:'none', color:'#fff', fontSize:11, padding:'5px 10px', borderRadius:6, cursor:'pointer', fontFamily: MONO }} onClick={() => handleEdit(msg.id)}>save</button>
                    <button style={{ background:'none', border:'none', color:'#555', fontSize:11, cursor:'pointer', fontFamily: MONO }} onClick={() => setEditingId(null)}>cancel</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:6, flexDirection: mine ? 'row-reverse' : 'row' }}>
                    <div style={{
                      padding:'11px 15px', borderRadius:18,
                      borderBottomRightRadius: mine ? 4 : 18,
                      borderBottomLeftRadius: mine ? 18 : 4,
                      background: bubbleColor,
                      border: mine ? '1px solid rgba(29,155,240,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      color: textColor,
                      fontSize:15, lineHeight:1.6, fontFamily: FONT,
                    }}
                      onDoubleClick={() => { if (mine) { setEditingId(msg.id); setEditContent(msg.content) } }}>
                      {msg.content}
                    </div>
                    <button style={{ background:'none', border:'none', cursor:'pointer', padding:4, opacity:0.5, flexShrink:0, marginBottom:4 }}
                      onClick={() => handleCopy(msg.id, msg.content)}>
                      {isCopied
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      }
                    </button>
                  </div>
                )}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:3, padding:'0 4px', justifyContent: mine ? 'flex-end' : 'flex-start', fontFamily: MONO }}>
                  <span style={{ fontSize:10, color:'#444' }}>{formatTime(msg.created_at)}</span>
                  {msg.is_edited && <span style={{ fontSize:10, color:'#444' }}>edited</span>}
                  {mine && !editingId && (
                    <>
                      <span style={{ fontSize:10, color: BLUE, cursor:'pointer' }} onClick={() => { setEditingId(msg.id); setEditContent(msg.content) }}>edit</span>
                      <span style={{ fontSize:10, color:'#e24b4a', cursor:'pointer' }} onClick={() => handleDelete(msg.id)}>delete</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {canSend ? (
        <div style={{ ...GLASS, padding:'10px 16px 20px', display:'flex', alignItems:'flex-end', gap:10, flexShrink:0, marginBottom:12 }}>
          <div style={{ flex:1, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${BORDER}`, borderRadius:22, display:'flex', alignItems:'center', padding:'9px 14px', gap:8 }}>
            <textarea style={{ flex:1, background:'none', border:'none', outline:'none', color:'#fff', fontSize:15, fontWeight:300, resize:'none', maxHeight:100, lineHeight:1.5, caretColor: BLUE, fontFamily: FONT }}
              placeholder="message..." value={input} rows={1}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} />
            {input.length > 0 && (
              <button style={{ background:'none', border:'none', cursor:'pointer', display:'flex', padding:'0 2px' }} onClick={() => setInput('')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
            <button style={{ background:'none', border:'none', cursor:'pointer', display:'flex', color: recording ? '#e24b4a' : '#555' }} onClick={handleMic}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7M12 17v4M8 21h8"/>
              </svg>
            </button>
          </div>
          <button style={{ width:44, height:44, borderRadius:'50%', background: BLUE, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
            onClick={() => handleSend()}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>
          </button>
        </div>
      ) : (
        <div style={{ padding:'14px 20px', borderTop:`0.5px solid ${BORDER}`, textAlign:'center', fontSize:12, color:'#444', fontFamily: MONO }}>read only · you cannot send messages</div>
      )}
    </div>
  )
}
