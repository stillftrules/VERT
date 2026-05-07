import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export default function ChatScreen() {
  const { contactUsername } = useParams()
  const { session, canSend } = useAuth()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [recording, setRecording] = useState(false)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

  const myUsername = session.client.username
  const otherUsername = contactUsername
  const convoKey = [myUsername, otherUsername].sort().join('::')

  useEffect(() => {
    async function init() {
      // Look for existing shared conversation by convo_key
      let { data: convo } = await supabase
        .from('conversations')
        .select('*')
        .eq('convo_key', convoKey)
        .single()

      if (!convo) {
        // Create it — only one shared conversation per pair
        const { data: newConvo, error } = await supabase
          .from('conversations')
          .insert({
            client_id: session.client.id,
            user_id: null,
            contact_username: convoKey,
            convo_key: convoKey
          })
          .select()
          .single()

        if (error) {
          // Race condition — try fetching again
          const { data: retry } = await supabase
            .from('conversations')
            .select('*')
            .eq('convo_key', convoKey)
            .single()
          convo = retry
        } else {
          convo = newConvo
        }
      }

      if (!convo) return
      setConversationId(convo.id)

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convo.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      setMessages(msgs || [])

      // Clean up old channel
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      // Subscribe to real-time messages
      const channel = supabase
        .channel(`chat-${convo.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${convo.id}`
          },
          (payload) => {
            setMessages(prev => {
              if (prev.find(m => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${convo.id}`
          },
          (payload) => {
            if (payload.new.is_deleted) {
              setMessages(prev => prev.filter(m => m.id !== payload.new.id))
            } else {
              setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
            }
          }
        )

      channel.subscribe()
      channelRef.current = channel
    }

    init()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [contactUsername, session])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(isTranscribed = false) {
    if (!input.trim() || !canSend || !conversationId) return
    const content = input.trim()
    setInput('')

    const { data: msg, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        client_id: session.client.id,
        sender: 'user',
        sent_by_user_id: session.user.id,
        content,
        is_transcribed: isTranscribed,
        meta: { from_username: myUsername, to_username: otherUsername }
      })
      .select()
      .single()

    if (!error) {
      await supabase
        .from('conversations')
        .update({ last_message: content, last_message_at: msg.created_at })
        .eq('id', conversationId)

      await supabase.from('audit_log').insert({
        event_type: 'message_sent',
        client_id: session.client.id,
        user_id: session.user.id,
        message_id: msg.id,
        meta: { from: myUsername, to: otherUsername, preview: content.slice(0, 60) }
      })
    }
  }

  async function handleEdit(id) {
    await supabase
      .from('messages')
      .update({ content: editContent, is_edited: true, edited_at: new Date().toISOString() })
      .eq('id', id)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: editContent, is_edited: true } : m))
    setEditingId(null)
  }

  async function handleDelete(id) {
    await supabase.from('messages').update({ is_deleted: true }).eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  function handleMic() {
    setRecording(r => !r)
    if (recording) setInput('Voice message transcribed here')
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Message is mine if from_username matches my username
  function isMine(msg) {
    if (msg.meta?.from_username) return msg.meta.from_username === myUsername
    return msg.client_id === session.client.id
  }

  const initials = (str) => str ? str.slice(0, 2).toUpperCase() : '??'

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/inbox')}>←</button>
        <div style={{ ...s.avatar, background:'#1e2d4a', color:'#378add' }}>
          {initials(otherUsername)}
        </div>
        <div style={s.headerInfo}>
          <div style={s.headerHandle}>@{otherUsername}</div>
          <div style={s.headerStatus}>online · 7am–11pm ET</div>
        </div>
      </div>

      <div style={s.threadBanner}>
        👤 {session.user.full_name} · sending as @{myUsername} · relay responses to your client
      </div>

      <div style={s.messages}>
        {messages.length === 0 && (
          <div style={s.noMessages}>no messages yet — say hello!</div>
        )}
        {messages.map(msg => {
          const mine = isMine(msg)
          return (
            <div key={msg.id} style={{ ...s.msgRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              {!mine && (
                <div style={{ ...s.msgAvatar, background:'#1e2d4a', color:'#378add' }}>
                  {initials(otherUsername)}
                </div>
              )}
              <div>
                {editingId === msg.id ? (
                  <div style={s.editWrap}>
                    <input style={s.editInput} value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEdit(msg.id)}
                      autoFocus />
                    <button style={s.editSave} onClick={() => handleEdit(msg.id)}>save</button>
                    <button style={s.editCancel} onClick={() => setEditingId(null)}>cancel</button>
                  </div>
                ) : (
                  <div style={{ ...s.bubble, ...(mine ? s.bubbleMine : s.bubbleTheirs) }}
                    onDoubleClick={() => { if (mine) { setEditingId(msg.id); setEditContent(msg.content) } }}>
                    {msg.content}
                  </div>
                )}
                <div style={{ ...s.msgTime, textAlign: mine ? 'right' : 'left' }}>
                  {formatTime(msg.created_at)}
                  {msg.is_edited && <span style={{ color:'#333' }}> · edited</span>}
                  {msg.is_transcribed && <span style={{ color:'#0f6e56' }}> 🎤</span>}
                  {mine && !editingId && (
                    <span>
                      {' '}·{' '}
                      <span style={s.actionLink} onClick={() => { setEditingId(msg.id); setEditContent(msg.content) }}>edit</span>
                      {' '}
                      <span style={{ ...s.actionLink, color:'#e24b4a' }} onClick={() => handleDelete(msg.id)}>delete</span>
                    </span>
                  )}
                </div>
              </div>
              {mine && (
                <div style={{ ...s.msgAvatar, background:'#1e6a4a', color:'#5dcaa5' }}>
                  {initials(myUsername)}
                </div>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {canSend && (
        <div style={s.inputRow}>
          <div style={s.inputWrap}>
            <textarea style={s.input} placeholder="message..." value={input} rows={1}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} />
            <button style={{ ...s.micBtn, color: recording ? '#e24b4a' : '#555' }} onClick={handleMic}>🎤</button>
          </div>
          <button style={s.sendBtn} onClick={() => handleSend()}>➤</button>
        </div>
      )}
      {!canSend && <div style={s.readOnlyBar}>read only · you cannot send messages</div>}
    </div>
  )
}

const s = {
  wrap: { background:'#0e0e10', minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:"'Syne',sans-serif", color:'#f0ede6', maxWidth:480, margin:'0 auto' },
  header: { padding:'14px 16px 12px', borderBottom:'0.5px solid #1e1e22', display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  backBtn: { background:'none', border:'none', color:'#1d9e75', fontSize:20, cursor:'pointer' },
  avatar: { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 },
  headerInfo: { flex:1 },
  headerHandle: { fontSize:15, fontWeight:600 },
  headerStatus: { fontSize:11, color:'#1d9e75', fontFamily:"'DM Mono',monospace" },
  threadBanner: { background:'#13201a', borderBottom:'0.5px solid #1a2e22', padding:'6px 16px', fontSize:10, fontFamily:"'DM Mono',monospace", color:'#0f6e56', flexShrink:0 },
  messages: { flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 },
  noMessages: { textAlign:'center', color:'#333', fontSize:12, fontFamily:"'DM Mono',monospace", marginTop:40 },
  msgRow: { display:'flex', gap:8, alignItems:'flex-end' },
  msgAvatar: { width:26, height:26, borderRadius:'50%', fontSize:10, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  bubble: { padding:'9px 13px', borderRadius:16, fontSize:13, lineHeight:1.5, maxWidth:260 },
  bubbleMine: { background:'#1d9e75', color:'#e1f5ee', borderBottomRightRadius:4 },
  bubbleTheirs: { background:'#1a1a1e', color:'#d8d5ce', border:'0.5px solid #2a2a2e', borderBottomLeftRadius:4 },
  msgTime: { fontSize:9, color:'#444', fontFamily:"'DM Mono',monospace", marginTop:3, padding:'0 4px' },
  actionLink: { color:'#1d9e75', cursor:'pointer', textDecoration:'underline' },
  editWrap: { display:'flex', gap:6, alignItems:'center' },
  editInput: { background:'#1a1a1e', border:'0.5px solid #1d9e75', borderRadius:8, color:'#f0ede6', padding:'6px 10px', fontSize:13, fontFamily:"'Syne',sans-serif", outline:'none', width:200 },
  editSave: { background:'#1d9e75', border:'none', color:'#04342c', fontSize:11, fontFamily:"'DM Mono',monospace", padding:'4px 10px', borderRadius:5, cursor:'pointer' },
  editCancel: { background:'none', border:'none', color:'#555', fontSize:11, fontFamily:"'DM Mono',monospace", cursor:'pointer' },
  inputRow: { padding:'10px 12px 16px', borderTop:'0.5px solid #1e1e22', display:'flex', alignItems:'flex-end', gap:8, flexShrink:0 },
  inputWrap: { flex:1, background:'#1a1a1e', border:'0.5px solid #2a2a2e', borderRadius:20, display:'flex', alignItems:'center', padding:'8px 14px', gap:8 },
  input: { flex:1, background:'none', border:'none', outline:'none', color:'#f0ede6', fontSize:14, fontFamily:"'Syne',sans-serif", resize:'none', maxHeight:80, lineHeight:1.4 },
  micBtn: { background:'none', border:'none', cursor:'pointer', fontSize:17, display:'flex', alignItems:'center' },
  sendBtn: { width:38, height:38, borderRadius:'50%', background:'#1d9e75', border:'none', cursor:'pointer', color:'#04342c', fontSize:17, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  readOnlyBar: { padding:'12px 16px', borderTop:'0.5px solid #1e1e22', textAlign:'center', fontSize:11, fontFamily:"'DM Mono',monospace", color:'#444', flexShrink:0 }
}
