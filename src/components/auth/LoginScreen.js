import React, { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { validateAccessCode } from '../../lib/accessCodes'

const FONT = "'Clarity City', 'DM Mono', sans-serif"
const MONO = "'DM Mono', monospace"

export default function LoginScreen({ onSuccess, onGoBack }) {
  const { addSession, sessions } = useAuth()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle')

  async function handlePress(digit) {
    if (code.length >= 4) return
    const next = code + digit
    setCode(next)
    setStatus('idle')
    if (next.length === 4) {
      setStatus('checking')
      try {
        const result = await validateAccessCode(next)
        if (result.valid) {
          addSession(result.session)
          if (onSuccess) onSuccess()
        } else {
          setStatus('error')
          setTimeout(() => { setCode(''); setStatus('idle') }, 900)
        }
      } catch {
        setStatus('error')
        setTimeout(() => { setCode(''); setStatus('idle') }, 900)
      }
    }
  }

  function handleDelete() {
    setCode(c => c.slice(0, -1))
    setStatus('idle')
  }

  const hasClients = sessions && Object.keys(sessions).length > 0

  const keys = [
    ['1',''],['2','ABC'],['3','DEF'],
    ['4','GHI'],['5','JKL'],['6','MNO'],
    ['7','PQRS'],['8','TUV'],['9','WXYZ'],
    [null,null],['0',''],['del',null]
  ]

  const statusText = status === 'checking' ? 'verifying...'
    : status === 'error' ? 'incorrect code — try again'
    : 'your daily code was sent\nto you by your loved one'

  const neu = {
    shadow: '6px 6px 12px #12141c, -4px -4px 10px #252528',
    pressed: 'inset 4px 4px 8px #12141c, inset -2px -2px 6px #252528',
  }

  return (
    <div style={{ ...s.wrap, fontFamily: FONT }}>
      <div style={s.topSection}>
        <div style={s.logoMark}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#1a1a1e"/>
            <path d="M8 12C8 10.3431 9.34315 9 11 9H25C26.6569 9 28 10.3431 28 12V20C28 21.6569 26.6569 23 25 23H20L15 27V23H11C9.34315 23 8 21.6569 8 20V12Z" fill="#F5C518"/>
          </svg>
        </div>
        <div style={{ ...s.appName, fontFamily: MONO }}>BANQO</div>
        <div style={s.headline}>Let's Get Started!</div>
        <div style={{ ...s.subline, fontFamily: MONO }}>{statusText}</div>
      </div>

      <div style={s.codeSection}>
        <div style={s.boxesRow}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              ...s.codeBox,
              boxShadow: neu.shadow,
              ...(i < code.length ? s.codeBoxFilled : {}),
              ...(status === 'error' ? s.codeBoxError : {})
            }}>
              <span style={{
                ...s.codeDigit,
                fontFamily: MONO,
                ...(i < code.length ? s.codeDigitFilled : {}),
                ...(status === 'error' && i < code.length ? { color:'#e24b4a' } : {})
              }}>
                {i < code.length ? '•' : '0'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.keypadSection}>
        <div style={s.keypad}>
          {keys.map(([digit, letters], idx) => {
            if (digit === null) return <div key={idx} />
            if (digit === 'del') return (
              <div key={idx} style={s.keyDel} onClick={handleDelete}>
                <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
                  <path d="M9 1H22C23.1 1 24 1.9 24 3V15C24 16.1 23.1 17 22 17H9L1 9L9 1Z" stroke="#888aa0" strokeWidth="1.5" fill="none"/>
                  <path d="M15 6L18 9M18 9L15 12M18 9L12 9" stroke="#888aa0" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            )
            return (
              <div key={idx} style={{ ...s.key, boxShadow: neu.shadow, fontFamily: FONT }}
                onClick={() => handlePress(digit)}
                onMouseDown={e => e.currentTarget.style.boxShadow = neu.pressed}
                onMouseUp={e => e.currentTarget.style.boxShadow = neu.shadow}
                onTouchStart={e => e.currentTarget.style.boxShadow = neu.pressed}
                onTouchEnd={e => e.currentTarget.style.boxShadow = neu.shadow}>
                <div style={{ ...s.keyNum, fontFamily: MONO }}>{digit}</div>
                {letters && <div style={{ ...s.keyLetters, fontFamily: MONO }}>{letters}</div>}
              </div>
            )
          })}
        </div>
        {hasClients && (
          <button style={{ ...s.backBtn, fontFamily: MONO }} onClick={onSuccess}>← back to my clients</button>
        )}
        {onGoBack && (
          <button style={{ ...s.backBtn, fontFamily: MONO, color:'#888aa0', marginTop:8 }} onClick={onGoBack}>← back to dashboard</button>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: { background:'#111114', minHeight:'100vh', display:'flex', flexDirection:'column', color:'#ffffff', maxWidth:420, margin:'0 auto', paddingBottom:40 },
  topSection: { padding:'60px 32px 32px', display:'flex', flexDirection:'column', alignItems:'flex-start' },
  logoMark: { marginBottom:24 },
  appName: { fontSize:13, fontWeight:600, color:'#F5C518', letterSpacing:'0.2em', marginBottom:12 },
  headline: { fontSize:30, fontWeight:700, color:'#ffffff', marginBottom:8, lineHeight:1.2 },
  subline: { fontSize:15, color:'#888aa0', lineHeight:1.6, whiteSpace:'pre-line' },
  codeSection: { padding:'24px 32px 32px' },
  boxesRow: { display:'flex', gap:14 },
  codeBox: { flex:1, height:64, borderRadius:14, background:'#1a1a1e', display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid #252528', transition:'all 0.15s' },
  codeBoxFilled: { border:'1.5px solid #F5C518' },
  codeBoxError: { border:'1.5px solid #e24b4a' },
  codeDigit: { fontSize:28, color:'#252528', fontWeight:600 },
  codeDigitFilled: { color:'#F5C518' },
  keypadSection: { padding:'0 24px' },
  keypad: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 },
  key: { background:'#1a1a1e', borderRadius:14, padding:'18px 8px', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer', userSelect:'none', border:'0.5px solid #252528', transition:'box-shadow 0.1s' },
  keyDel: { display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:'18px 8px', borderRadius:14 },
  keyNum: { fontSize:26, fontWeight:600, color:'#ffffff', lineHeight:1 },
  keyLetters: { fontSize:10, color:'#888aa0', letterSpacing:'0.12em', marginTop:5 },
  backBtn: { background:'none', border:'none', color:'#F5C518', fontSize:14, cursor:'pointer', marginTop:28, width:'100%', textAlign:'center', padding:8 }
}
