import React, { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { validateAccessCode } from '../../lib/accessCodes'

export default function LoginScreen() {
  const { login } = useAuth()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | error | revoked

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
          login(result.session)
        } else {
          setStatus('error')
          setTimeout(() => { setCode(''); setStatus('idle') }, 1000)
        }
      } catch {
        setStatus('error')
        setTimeout(() => { setCode(''); setStatus('idle') }, 1000)
      }
    }
  }

  function handleDelete() {
    setCode(c => c.slice(0, -1))
    setStatus('idle')
  }

  const dotColor = (i) => {
    if (i < code.length) {
      return status === 'error' ? '#e24b4a' : '#1d9e75'
    }
    return 'transparent'
  }

  const keys = [
    ['1',''], ['2','ABC'], ['3','DEF'],
    ['4','GHI'], ['5','JKL'], ['6','MNO'],
    ['7','PQRS'], ['8','TUV'], ['9','WXYZ'],
    [null,null], ['0',''], ['del',null]
  ]

  return (
    <div style={styles.wrap}>
      <div style={styles.logoWrap}>
        <div style={styles.logoMark}>💬</div>
        <div style={styles.appName}>Vert</div>
      </div>

      <div style={styles.body}>
        <div style={styles.lockIcon}>🔐</div>
        <div style={styles.title}>enter your access code</div>
        <div style={styles.sub}>
          {status === 'checking'
            ? 'verifying...'
            : status === 'error'
            ? 'incorrect code — try again'
            : 'your daily code was sent to you\nby your loved one'}
        </div>

        <div style={styles.dotsRow}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              ...styles.dot,
              background: dotColor(i),
              borderColor: status === 'error' ? '#e24b4a' : i < code.length ? '#1d9e75' : '#2a2a2e',
              transform: i < code.length ? 'scale(1.15)' : 'scale(1)'
            }} />
          ))}
        </div>

        <div style={styles.keypad}>
          {keys.map(([digit, letters], idx) => {
            if (digit === null) return <div key={idx} />
            if (digit === 'del') return (
              <div key={idx} style={styles.keyAction} onClick={handleDelete}>⌫</div>
            )
            return (
              <div key={idx} style={styles.key} onClick={() => handlePress(digit)}>
                <div style={styles.keyNum}>{digit}</div>
                {letters && <div style={styles.keyLetters}>{letters}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrap: { background:'#0e0e10', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', fontFamily:"'Syne', sans-serif", color:'#f0ede6' },
  logoWrap: { paddingTop:48, display:'flex', flexDirection:'column', alignItems:'center', gap:8, marginBottom:28 },
  logoMark: { width:54, height:54, borderRadius:16, background:'#1e6a4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 },
  appName: { fontSize:22, fontWeight:700, color:'#f0ede6' },
  body: { display:'flex', flexDirection:'column', alignItems:'center', width:'100%', maxWidth:360, padding:'0 24px' },
  lockIcon: { fontSize:32, marginBottom:16 },
  title: { fontSize:18, fontWeight:700, marginBottom:8 },
  sub: { fontSize:12, color:'#555', fontFamily:"'DM Mono', monospace", textAlign:'center', marginBottom:28, whiteSpace:'pre-line', lineHeight:1.6 },
  dotsRow: { display:'flex', gap:16, marginBottom:32 },
  dot: { width:15, height:15, borderRadius:'50%', border:'1.5px solid #2a2a2e', transition:'all 0.15s' },
  keypad: { width:'100%', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 },
  key: { background:'#1a1a1e', border:'0.5px solid #2a2a2e', borderRadius:12, padding:'16px 8px', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer', userSelect:'none' },
  keyNum: { fontSize:22, fontWeight:600, color:'#f0ede6', fontFamily:"'DM Mono', monospace" },
  keyLetters: { fontSize:9, color:'#444', letterSpacing:'0.12em', fontFamily:"'DM Mono', monospace", marginTop:3 },
  keyAction: { background:'transparent', border:'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#888', cursor:'pointer' }
}
