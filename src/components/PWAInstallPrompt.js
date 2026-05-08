import React, { useState, useEffect } from 'react'

const FONT = "'Clarity City', 'DM Mono', sans-serif"
const MONO = "'DM Mono', monospace"

const BROWSERS = [
  { id: 'safari',  label: 'Safari',      icon: '🧭' },
  { id: 'chrome',  label: 'Chrome',      icon: '🔵' },
  { id: 'duck',    label: 'DuckDuckGo',  icon: '🦆' },
  { id: 'firefox', label: 'Firefox',     icon: '🦊' },
  { id: 'other',   label: 'Other',       icon: '🌐' },
]

const INSTRUCTIONS = {
  safari: [
    { n:'1', text: <>Tap the <strong style={{color:'#818cf8'}}>Share button</strong> at the bottom of your screen — it looks like a box with an arrow pointing up ↑</> },
    { n:'2', text: <>Scroll down and tap <strong style={{color:'#818cf8'}}>"Add to Home Screen"</strong></> },
    { n:'3', text: <>Tap <strong style={{color:'#818cf8'}}>"Add"</strong> in the top right corner</> },
  ],
  chrome: [
    { n:'1', text: <>Tap the <strong style={{color:'#818cf8'}}>Share button</strong> in your browser — look for a box with an arrow ↑ or the share icon ⎙</> },
    { n:'2', text: <>Scroll and tap <strong style={{color:'#818cf8'}}>"Add to Home Screen"</strong></> },
    { n:'3', text: <>Tap <strong style={{color:'#818cf8'}}>"Add"</strong> to confirm</> },
  ],
  duck: [
    { n:'1', text: <>Tap the <strong style={{color:'#818cf8'}}>Share button</strong> — it appears at the bottom of your screen ↑</> },
    { n:'2', text: <>Tap <strong style={{color:'#818cf8'}}>"Add to Home Screen"</strong></> },
    { n:'3', text: <>Tap <strong style={{color:'#818cf8'}}>"Add"</strong> to confirm</> },
  ],
  firefox: [
    { n:'1', text: <>Tap the <strong style={{color:'#818cf8'}}>three dots menu</strong> (⋮) at the bottom of your screen</> },
    { n:'2', text: <>Tap <strong style={{color:'#818cf8'}}>"Install"</strong> or <strong style={{color:'#818cf8'}}>"Add to Home Screen"</strong></> },
    { n:'3', text: <>Tap <strong style={{color:'#818cf8'}}>"Add"</strong> to confirm</> },
  ],
  other: [
    { n:'1', text: <>Open your browser's <strong style={{color:'#818cf8'}}>menu</strong> — look for a Share button ↑ or three dots ⋮</> },
    { n:'2', text: <>Look for <strong style={{color:'#818cf8'}}>"Add to Home Screen"</strong></> },
    { n:'3', text: <>Tap <strong style={{color:'#818cf8'}}>"Add"</strong> to confirm</> },
  ],
}

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false)
  const [selectedBrowser, setSelectedBrowser] = useState(null)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    if (isStandalone) return

    const dismissed = localStorage.getItem('banqo_pwa_dismissed')
    if (dismissed) return

    // Capture Android auto-install prompt if available
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    })

    // Show after 4 seconds
    const t = setTimeout(() => setShow(true), 4000)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    localStorage.setItem('banqo_pwa_dismissed', '1')
    setShow(false)
  }

  async function autoInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
      else dismiss()
    }
  }

  if (!show) return null

  const steps = selectedBrowser ? INSTRUCTIONS[selectedBrowser] : null

  return (
    <div style={s.overlay}>
      <div style={{ ...s.sheet, fontFamily: FONT }}>
        <button style={s.closeBtn} onClick={dismiss}>✕</button>

        {/* Header */}
        <div style={s.iconRow}>
          <div style={s.icon}>
            <svg width="40" height="40" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#131628"/>
              <path d="M8 12C8 10.3431 9.34315 9 11 9H25C26.6569 9 28 10.3431 28 12V20C28 21.6569 26.6569 23 25 23H20L15 27V23H11C9.34315 23 8 21.6569 8 20V12Z" fill="#818cf8"/>
            </svg>
          </div>
          <div>
            <div style={{ ...s.appName, fontFamily: MONO }}>BANQO</div>
            <div style={{ ...s.appSub, fontFamily: MONO }}>Add to your home screen</div>
          </div>
        </div>

        <div style={{ ...s.desc, fontFamily: MONO }}>
          Get the full app experience — no browser bar, instant access from your home screen.
        </div>

        {/* Android auto-install */}
        {deferredPrompt && !selectedBrowser && (
          <button style={{ ...s.installBtn, fontFamily: FONT, marginBottom: 12 }} onClick={autoInstall}>
            Add to Home Screen
          </button>
        )}

        {/* Browser selector */}
        {!selectedBrowser && (
          <>
            <div style={{ ...s.sectionLabel, fontFamily: MONO }}>Which browser are you using?</div>
            <div style={s.browserGrid}>
              {BROWSERS.map(b => (
                <button key={b.id} style={{ ...s.browserBtn, fontFamily: MONO }} onClick={() => setSelectedBrowser(b.id)}>
                  <span style={{ fontSize: 20 }}>{b.icon}</span>
                  <span style={{ fontSize: 12, marginTop: 4 }}>{b.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Instructions for selected browser */}
        {selectedBrowser && steps && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <span style={{ fontSize:18 }}>{BROWSERS.find(b=>b.id===selectedBrowser)?.icon}</span>
              <span style={{ ...s.sectionLabel, fontFamily: MONO, margin:0 }}>
                {BROWSERS.find(b=>b.id===selectedBrowser)?.label} instructions
              </span>
              <button style={s.changeBrowser} onClick={() => setSelectedBrowser(null)}>change</button>
            </div>
            <div style={s.steps}>
              {steps.map(({ n, text }) => (
                <div key={n} style={s.step}>
                  <div style={s.stepNum}>{n}</div>
                  <div style={s.stepText}>{text}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <button style={{ ...s.dismissBtn, fontFamily: MONO }} onClick={dismiss}>maybe later</button>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position:'fixed', bottom:0, left:0, right:0, zIndex:9999,
    background:'rgba(0,0,0,0.88)',
    display:'flex', alignItems:'flex-end', justifyContent:'center'
  },
  sheet: {
    background: 'linear-gradient(160deg, #0d1535 0%, #131628 60%, #0a1020 100%)',
    border: '1.5px solid #818cf8',
    boxShadow: '0 -8px 48px rgba(129,140,248,0.25), 0 0 0 1px rgba(129,140,248,0.1)',
    borderRadius:'20px 20px 0 0',
    padding:'28px 24px 40px',
    width:'100%',
    maxWidth:480,
    position:'relative'
  },
  closeBtn: { position:'absolute', top:16, right:16, background:'none', border:'none', color:'#888aa0', fontSize:18, cursor:'pointer', padding:4 },
  iconRow: { display:'flex', alignItems:'center', gap:14, marginBottom:16 },
  icon: { width:48, height:48, borderRadius:12, overflow:'hidden', flexShrink:0 },
  appName: { fontSize:18, fontWeight:700, color:'#ffffff', letterSpacing:'0.1em' },
  appSub: { fontSize:12, color:'#818cf8', marginTop:2 },
  desc: { fontSize:13, color:'#aaaacc', lineHeight:1.6, marginBottom:20 },
  sectionLabel: { fontSize:11, color:'#888aa0', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:12 },
  browserGrid: { display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8, marginBottom:16 },
  browserBtn: {
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    background:'rgba(129,140,248,0.08)', border:'1px solid rgba(129,140,248,0.2)',
    borderRadius:12, padding:'12px 6px', color:'#ccccee', cursor:'pointer',
    gap:4
  },
  changeBrowser: { marginLeft:'auto', background:'none', border:'none', color:'#818cf8', fontSize:12, cursor:'pointer', fontFamily: MONO },
  steps: { display:'flex', flexDirection:'column', gap:16, marginBottom:20 },
  step: { display:'flex', gap:12, alignItems:'flex-start' },
  stepNum: { width:26, height:26, borderRadius:8, background:'#818cf8', color:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 },
  stepText: { fontSize:14, color:'#ffffff', lineHeight:1.6 },
  installBtn: { width:'100%', padding:'14px', background:'#818cf8', border:'none', borderRadius:12, color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer' },
  dismissBtn: { width:'100%', padding:'12px', background:'none', border:'none', color:'#555', fontSize:13, cursor:'pointer', marginTop:4 }
}
