import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const FONT = "'Clarity City', 'DM Mono', sans-serif"
const MONO = "'DM Mono', monospace"
const BG = '#0d0f1a'
const CARD = '#131628'
const BORDER = '#1e2240'

export default function PublicLanding({ onEnterCode }) {
  const [view, setView] = useState('home')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [reqForm, setReqForm] = useState({ firstName:'', note:'' })
  const [signupForm, setSignupForm] = useState({
    username:'', firstName:'', lastName:'',
    idNumber:['','','','','','',''],
    submittedBy:'', note:''
  })
  const [signupUsernameAvail, setSignupUsernameAvail] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const idRefs = useRef([])

  const initials = (str) => str ? str.slice(0,2).toUpperCase() : '??'
  const avatarColors = [['#1a1c3a','#818cf8'],['#0f2030','#60a5fa'],['#0f2a1e','#4ade80'],['#1e1630','#a78bfa'],['#1a2030','#38bdf8']]
  const colorFor = (str) => avatarColors[(str||'').charCodeAt(0) % avatarColors.length]
  const neu = { card: '5px 5px 12px #0a0a0c, -2px -2px 6px #1c1c20' }

  async function doSearch(val) {
    setSearch(val)
    if (!val.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('clients').select('id, username, full_name').ilike('username', `%${val}%`).eq('status', 'active').limit(6)
    setSearchResults(data || [])
    setSearching(false)
  }

  useEffect(() => {
    if (!signupForm.username) { setSignupUsernameAvail(null); return }
    setSignupUsernameAvail('checking')
    const timer = setTimeout(async () => {
      const uname = signupForm.username.toLowerCase()
      const [{ data: ru }, { data: cl }] = await Promise.all([
        supabase.from('registered_users').select('id').eq('username', uname).single(),
        supabase.from('clients').select('id').eq('username', uname).single()
      ])
      setSignupUsernameAvail(ru || cl ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [signupForm.username])

  function handleIdSegment(idx, val) {
    const segments = [...signupForm.idNumber]
    const isLetter = idx === 2
    const cleaned = isLetter
      ? val.replace(/[^a-zA-Z]/g,'').toUpperCase().slice(0,1)
      : val.replace(/[^0-9]/g,'').slice(0,1)
    segments[idx] = cleaned
    setSignupForm(p => ({...p, idNumber: segments}))
    if (cleaned && idx < 6) setTimeout(() => idRefs.current[idx+1]?.focus(), 10)
  }

  function handleIdKeyDown(idx, e) {
    if (e.key === 'Backspace' && !signupForm.idNumber[idx] && idx > 0) idRefs.current[idx-1]?.focus()
  }

  async function submitRequest() {
    if (!reqForm.firstName || !selectedClient) return
    setSubmitting(true)
    try {
      await supabase.from('audit_log').insert({
        event_type: 'access_request', client_id: selectedClient.id,
        meta: { first_name: reqForm.firstName, note: reqForm.note, client_username: selectedClient.username, requested_at: new Date().toISOString() }
      })
      setSubmitted(true)
    } catch(e) { console.error(e) }
    setSubmitting(false)
  }

  async function submitSignup() {
    const { username, firstName, lastName, idNumber, submittedBy } = signupForm
    if (!firstName || !lastName || !username) return
    setSubmitting(true)
    try {
      const idStr = `${idNumber[0]}${idNumber[1]}-${idNumber[2]}-${idNumber[3]}${idNumber[4]}${idNumber[5]}${idNumber[6]}`
      await supabase.from('clients').insert({
        username: username.toLowerCase().replace(/\s/g,''),
        full_name: `${firstName} ${lastName}`,
        first_name: firstName, last_name: lastName,
        id_number: idStr,
        submitted_by: submittedBy, submitted_by_name: submittedBy,
        signup_note: signupForm.note, status: 'pending'
      })
      setSubmitted(true)
    } catch(e) { console.error(e) }
    setSubmitting(false)
  }

  const resetHome = () => {
    setSubmitted(false); setView('home'); setSelectedClient(null)
    setReqForm({ firstName:'', note:'' })
    setSignupForm({ username:'', firstName:'', lastName:'', idNumber:['','','','','','',''], submittedBy:'', note:'' })
    setSignupUsernameAvail(null)
  }

  const availColor = (st) => st === 'available' ? '#4caf50' : st === 'taken' ? '#e24b4a' : '#888aa0'
  const availText = (st) => st === 'checking' ? 'checking...' : st === 'available' ? '✓ available' : st === 'taken' ? '✗ taken' : ''

  if (submitted) return (
    <div style={{ ...s.wrap, fontFamily: FONT }}>
      <Header />
      <div style={s.centeredBody}>
        <div style={s.successIcon}>✓</div>
        <div style={s.successTitle}>{view === 'request' ? 'Request sent!' : 'Signup submitted!'}</div>
        <div style={{ ...s.successSub, fontFamily: MONO }}>
          {view === 'request' ? "We'll reach out to your client and let you know if they approve." : "Our team will review and reach out to the client shortly."}
        </div>
        <button style={{ ...s.primaryBtn, fontFamily: FONT }} onClick={resetHome}>back to home</button>
      </div>
    </div>
  )

  return (
    <div style={{ ...s.wrap, fontFamily: FONT }}>
      <Header />

      {view === 'home' && (
        <div style={s.body}>
          <div style={s.heroSection}>
            <div style={{ ...s.heroSub, fontFamily: MONO }}>Banqo lets trusted people send and receive messages — seamlessly and securely.</div>
          </div>
          <button style={{ ...s.enterCodeBig, fontFamily: FONT }} onClick={onEnterCode}>ENTER CODE</button>
          <div style={{ ...s.dividerRow, fontFamily: MONO }}>
            <div style={s.dividerLine}/><span style={s.dividerText}>or</span><div style={s.dividerLine}/>
          </div>
          <div style={{ ...s.card, boxShadow: neu.card }} onClick={() => setView('request')}>
            <div style={s.cardIcon}>🔑</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Request Access</div>
              <div style={{ ...s.cardSub, fontFamily: MONO }}>Find a client and request a daily access code</div>
            </div>
            <div style={s.cardArrow}>→</div>
          </div>
          <div style={{ ...s.card, boxShadow: neu.card }} onClick={() => setView('signup')}>
            <div style={s.cardIcon}>✚</div>
            <div style={s.cardBody}>
              <div style={s.cardTitle}>Sign Up a Client</div>
              <div style={{ ...s.cardSub, fontFamily: MONO }}>Know someone who'd benefit from Banqo?</div>
            </div>
            <div style={s.cardArrow}>→</div>
          </div>
        </div>
      )}

      {view === 'request' && !selectedClient && (
        <div style={s.body}>
          <button style={s.backLink} onClick={() => setView('home')}>← back</button>
          <div style={s.pageTitle}>Request Access</div>
          <div style={{ ...s.pageSub, fontFamily: MONO }}>Search for a client username</div>
          <div style={{ ...s.searchBar, boxShadow: neu.card }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={{ ...s.searchInput, fontFamily: MONO }} placeholder="search username..." value={search} onChange={e => doSearch(e.target.value)} autoFocus />
          </div>
          {searching && <div style={{ ...s.hint, fontFamily: MONO }}>searching...</div>}
          {!searching && search && searchResults.length === 0 && <div style={{ ...s.hint, fontFamily: MONO }}>no users found</div>}
          {!search && <div style={{ ...s.hint, fontFamily: MONO }}>start typing to find a client</div>}
          <div style={s.resultsList}>
            {searchResults.map(client => {
              const [bg, fg] = colorFor(client.username)
              return (
                <div key={client.id} style={{ ...s.resultItem, boxShadow: neu.card }} onClick={() => setSelectedClient(client)}>
                  <GlowUsername username={client.username} size={15} />
                  <div>
                    <div style={s.resultName}>{client.full_name}</div>
                  </div>
                  <div style={{ color:'#F5C518', marginLeft:'auto' }}>→</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'request' && selectedClient && (
        <div style={s.body}>
          <button style={s.backLink} onClick={() => setSelectedClient(null)}>← back</button>
          <div style={s.pageTitle}>Request to @{selectedClient.username}</div>
          <div style={{ ...s.pageSub, fontFamily: MONO }}>Leave a note — we'll pass it along</div>
          <div style={{ ...s.formCard, boxShadow: neu.card }}>
            <div style={{ ...s.formLabel, fontFamily: MONO }}>your first name</div>
            <input style={{ ...s.formInput, fontFamily: FONT }} placeholder="e.g. Rachel" value={reqForm.firstName} onChange={e => setReqForm(p => ({...p, firstName: e.target.value}))} />
            <div style={{ ...s.formLabel, fontFamily: MONO }}>note to {selectedClient.full_name?.split(' ')[0] || 'client'} (optional)</div>
            <textarea style={{ ...s.formTextarea, fontFamily: FONT }} placeholder="Hey, it's me! I'm here to help if you need me."
              value={reqForm.note} onChange={e => setReqForm(p => ({...p, note: e.target.value}))} rows={4} />
            <button style={{ ...s.primaryBtn, fontFamily: FONT, opacity: !reqForm.firstName || submitting ? 0.4 : 1 }}
              disabled={!reqForm.firstName || submitting} onClick={submitRequest}>
              {submitting ? 'sending...' : 'send request'}
            </button>
          </div>
        </div>
      )}

      {view === 'signup' && (
        <div style={s.body}>
          <button style={s.backLink} onClick={() => setView('home')}>← back</button>
          <div style={s.pageTitle}>Sign Up a Client</div>
          <div style={{ ...s.pageSub, fontFamily: MONO }}>We'll review and reach out shortly</div>
          <div style={{ ...s.formCard, boxShadow: neu.card }}>
            <div style={{ ...s.formLabel, fontFamily: MONO }}>create username</div>
            <div style={s.usernameRow}>
              <div style={s.atSign}>@</div>
              <input style={{ ...s.formInput, ...s.usernameInput, fontFamily: MONO, margin:0 }}
                placeholder="username" value={signupForm.username}
                onChange={e => setSignupForm(p => ({...p, username: e.target.value.toLowerCase().replace(/\s/g,'')}))} />
            </div>
            {signupForm.username && (
              <div style={{ ...s.availMsg, color: availColor(signupUsernameAvail), fontFamily: MONO }}>
                {availText(signupUsernameAvail)}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:14 }}>
              <div>
                <div style={{ ...s.formLabel, fontFamily: MONO }}>first name</div>
                <input style={{ ...s.formInput, fontFamily: FONT }} placeholder="Phil" value={signupForm.firstName} onChange={e => setSignupForm(p => ({...p, firstName: e.target.value}))} />
              </div>
              <div>
                <div style={{ ...s.formLabel, fontFamily: MONO }}>last name</div>
                <input style={{ ...s.formInput, fontFamily: FONT }} placeholder="Johnson" value={signupForm.lastName} onChange={e => setSignupForm(p => ({...p, lastName: e.target.value}))} />
              </div>
            </div>
            <div style={{ ...s.formLabel, fontFamily: MONO }}>identification number</div>
            <div style={s.idRow}>
              {[0,1].map(i => (
                <input key={i} ref={el => idRefs.current[i] = el}
                  style={{ ...s.idBox, fontFamily: MONO }} maxLength={1} inputMode="numeric"
                  value={signupForm.idNumber[i]}
                  onChange={e => handleIdSegment(i, e.target.value)}
                  onKeyDown={e => handleIdKeyDown(i, e)} />
              ))}
              <div style={s.idDash}>—</div>
              <input ref={el => idRefs.current[2] = el}
                style={{ ...s.idBox, fontFamily: MONO }} maxLength={1}
                value={signupForm.idNumber[2]}
                onChange={e => handleIdSegment(2, e.target.value)}
                onKeyDown={e => handleIdKeyDown(2, e)} />
              <div style={s.idDash}>—</div>
              {[3,4,5,6].map(i => (
                <input key={i} ref={el => idRefs.current[i] = el}
                  style={{ ...s.idBox, fontFamily: MONO }} maxLength={1} inputMode="numeric"
                  value={signupForm.idNumber[i]}
                  onChange={e => handleIdSegment(i, e.target.value)}
                  onKeyDown={e => handleIdKeyDown(i, e)} />
              ))}
            </div>
            <div style={{ ...s.idHint, fontFamily: MONO }}>format: 47 — B — 3291</div>
            <div style={{ ...s.formLabel, fontFamily: MONO, marginTop:14 }}>submitted by (your name)</div>
            <input style={{ ...s.formInput, fontFamily: FONT }} placeholder="Your name" value={signupForm.submittedBy} onChange={e => setSignupForm(p => ({...p, submittedBy: e.target.value}))} />
            <div style={{ ...s.formLabel, fontFamily: MONO }}>send a note (optional)</div>
            <textarea style={{ ...s.formTextarea, fontFamily: FONT }} placeholder="Anything we should know..."
              value={signupForm.note} onChange={e => setSignupForm(p => ({...p, note: e.target.value}))} rows={3} />
            <button style={{ ...s.primaryBtn, fontFamily: FONT, opacity: (!signupForm.firstName || !signupForm.lastName || !signupForm.username || signupUsernameAvail === 'taken' || submitting) ? 0.4 : 1 }}
              disabled={!signupForm.firstName || !signupForm.lastName || !signupForm.username || signupUsernameAvail === 'taken' || submitting}
              onClick={submitSignup}>
              {submitting ? 'submitting...' : 'submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Header() {
  return (
    <div style={s.header}>
      <div style={s.logoRow}>
        <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="10" fill="#1a1a1e"/>
          <path d="M8 12C8 10.3431 9.34315 9 11 9H25C26.6569 9 28 10.3431 28 12V20C28 21.6569 26.6569 23 25 23H20L15 27V23H11C9.34315 23 8 21.6569 8 20V12Z" fill="#F5C518"/>
        </svg>
        <span style={{ fontSize:14, fontWeight:700, color:'#F5C518', letterSpacing:'0.2em', fontFamily:"'DM Mono',monospace" }}>BANQO</span>
      </div>
    </div>
  )
}

// Pulsing amber glow username component
export function GlowUsername({ username, size = 17, showAt = true }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', position:'relative' }}>
      <style>{`
        @keyframes indigoPulse {
          0%, 100% { text-shadow: 0 0 6px rgba(245,197,24,0.3), 0 0 12px rgba(245,197,24,0.15); }
          50% { text-shadow: 0 0 12px rgba(245,197,24,0.7), 0 0 24px rgba(245,197,24,0.4), 0 0 40px rgba(245,197,24,0.2); }
        }
        .glow-username {
          animation: indigoPulse 2.8s ease-in-out infinite;
          color: #818cf8;
          font-family: 'DM Mono', monospace;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
      `}</style>
      <span className="glow-username" style={{ fontSize: size }}>
        {showAt ? '@' : ''}{username}
      </span>
    </div>
  )
}

const s = {
  wrap: { minHeight:'100vh', display:'flex', flexDirection:'column', color:'#ffffff', maxWidth:480, margin:'0 auto', background: BG },
  header: { padding:'18px 20px 14px', borderBottom:`0.5px solid ${BORDER}`, display:'flex', alignItems:'center', flexShrink:0 },
  logoRow: { display:'flex', alignItems:'center', gap:10 },
  body: { flex:1, padding:'24px 20px', display:'flex', flexDirection:'column', gap:14 },
  heroSection: { marginBottom:4 },
  heroSub: { fontSize:15, color:'#888aa0', lineHeight:1.6 },
  enterCodeBig: { background:'#F5C518', border:'none', color:'#111114', fontSize:17, fontWeight:700, padding:'18px', borderRadius:14, cursor:'pointer', letterSpacing:'0.15em', width:'100%', display:'block' },
  dividerRow: { display:'flex', alignItems:'center', gap:12, fontSize:11, color:'#444' },
  dividerLine: { flex:1, height:'0.5px', background:BORDER },
  dividerText: { flexShrink:0 },
  card: { background:CARD, border:`0.5px solid ${BORDER}`, borderRadius:16, padding:'18px 16px', display:'flex', alignItems:'center', gap:14, cursor:'pointer' },
  cardIcon: { fontSize:26, flexShrink:0 },
  cardBody: { flex:1 },
  cardTitle: { fontSize:16, fontWeight:700, color:'#ffffff', marginBottom:4 },
  cardSub: { fontSize:13, color:'#888aa0' },
  cardArrow: { fontSize:20, color:'#F5C518', flexShrink:0 },
  backLink: { background:'none', border:'none', color:'#818cf8', fontSize:14, cursor:'pointer', padding:0, textAlign:'left' },
  pageTitle: { fontSize:24, fontWeight:700, color:'#ffffff', marginBottom:4 },
  pageSub: { fontSize:13, color:'#888aa0', marginBottom:4 },
  searchBar: { background:CARD, border:`0.5px solid ${BORDER}`, borderRadius:14, display:'flex', alignItems:'center', gap:10, padding:'12px 16px' },
  searchInput: { background:'none', border:'none', outline:'none', color:'#ffffff', fontSize:15, width:'100%' },
  hint: { textAlign:'center', color:'#444', fontSize:13, padding:'16px 0' },
  resultsList: { display:'flex', flexDirection:'column', gap:10 },
  resultItem: { background:CARD, border:`0.5px solid ${BORDER}`, borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' },
  resultName: { fontSize:13, color:'#888aa0', fontFamily: MONO, marginTop:3 },
  formCard: { background:CARD, border:`0.5px solid ${BORDER}`, borderRadius:16, padding:18 },
  formLabel: { fontSize:10, color:'#888aa0', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 },
  formInput: { background:'rgba(13,15,26,0.8)', border:`0.5px solid ${BORDER}`, borderRadius:8, color:'#ffffff', fontSize:15, fontWeight:200, padding:'11px 14px', width:'100%', outline:'none', marginBottom:14, display:'block', boxSizing:'border-box', caretColor:'#818cf8' },
  formTextarea: { background:'#111114', border:`0.5px solid ${BORDER}`, borderRadius:8, color:'#ffffff', fontSize:15, fontWeight:200, padding:'11px 14px', width:'100%', outline:'none', marginBottom:14, display:'block', boxSizing:'border-box', resize:'none', lineHeight:1.5, caretColor:'#F5C518' },
  usernameRow: { display:'flex', alignItems:'center', background:'#111114', border:`0.5px solid ${BORDER}`, borderRadius:8, marginBottom:6, overflow:'hidden' },
  atSign: { padding:'11px 8px 11px 14px', color:'#818cf8', fontSize:16, fontWeight:700, flexShrink:0, fontFamily:"'DM Mono',monospace" },
  usernameInput: { border:'none', borderRadius:0, marginBottom:0, background:'transparent', paddingLeft:4 },
  availMsg: { fontSize:11, marginBottom:8, fontWeight:500 },
  idRow: { display:'flex', alignItems:'center', gap:6, marginBottom:6 },
  idBox: { width:38, height:46, background:'#111114', border:`0.5px solid ${BORDER}`, borderRadius:8, color:'#818cf8', fontSize:18, fontWeight:700, textAlign:'center', outline:'none', padding:0 },
  idDash: { color:'#444', fontSize:18, fontWeight:300, flexShrink:0 },
  idHint: { fontSize:10, color:'#444', marginBottom:4 },
  primaryBtn: { background:'#F5C518', border:'none', color:'#111114', fontSize:16, fontWeight:700, padding:'13px', borderRadius:12, cursor:'pointer', width:'100%', display:'block', marginTop:4 },
  centeredBody: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px', textAlign:'center', gap:16 },
  successIcon: { width:64, height:64, borderRadius:'50%', background:'#1a1c3a', border:'2px solid #818cf8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:'#818cf8' },
  successTitle: { fontSize:24, fontWeight:700, color:'#ffffff' },
  successSub: { fontSize:14, color:'#888aa0', lineHeight:1.6 },
}
