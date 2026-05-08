import React, { useState, useEffect } from 'react'

const FONT = "'Clarity City', 'DM Mono', sans-serif"
const MONO = "'DM Mono', monospace"

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState(null)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // Already running as installed PWA — never show
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    if (isStandalone) return

    const dismissed = localStorage.getItem('banqo_pwa_dismissed')
    if (dismissed) return

    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    const isAndroid = /Android/.test(ua)
    const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua)
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)

    if (isIOS && isSafari) {
      // iOS Safari — can add to homescreen via share button
      setTimeout(() => { setPlatform('ios'); setShow(true) }, 4000)
    } else if (isAndroid && isChrome) {
      // Android Chrome — beforeinstallprompt fires
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setTimeout(() => { setPlatform('android'); setShow(true) }, 2000)
      })
    }
    // Desktop and other browsers — don't show, too many variations
  }, [])

  function dismiss() {
    localStorage.setItem('banqo_pwa_dismissed', '1')
    setShow(false)
  }

  async function installAndroid() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
      else dismiss()
    }
  }

  if (!show) return null

  return (
    <div style={s.overlay}>
      <div style={{ ...s.sheet, fontFamily: FONT }}>
        <button style={s.closeBtn} onClick={dismiss}>✕</button>

        <div style={s.iconRow}>
          <div style={s.icon}>
            <svg width="40" height="40" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#1a1a1e"/>
              <path d="M8 12C8 10.3431 9.34315 9 11 9H25C26.6569 9 28 10.3431 28 12V20C28 21.6569 26.6569 23 25 23H20L15 27V23H11C9.34315 23 8 21.6569 8 20V12Z" fill="#F5C518"/>
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

        {platform === 'ios' && (
          <div style={s.steps}>
            <div style={s.step}>
              <div style={s.stepNum}>1</div>
              <div style={s.stepText}>Tap the <strong style={{ color:'#F5C518' }}>Share</strong> button at the bottom of Safari <span style={{ ...s.stepHint, fontFamily: MONO }}>(the box with an arrow pointing up)</span></div>
            </div>
            <div style={s.step}>
              <div style={s.stepNum}>2</div>
              <div style={s.stepText}>Scroll down and tap <strong style={{ color:'#F5C518' }}>"Add to Home Screen"</strong></div>
            </div>
            <div style={s.step}>
              <div style={s.stepNum}>3</div>
              <div style={s.stepText}>Tap <strong style={{ color:'#F5C518' }}>"Add"</strong> in the top right corner</div>
            </div>
            <div style={{ ...s.iosNote, fontFamily: MONO }}>Must be opened in Safari for this to work</div>
          </div>
        )}

        {platform === 'android' && (
          <button style={{ ...s.installBtn, fontFamily: FONT }} onClick={installAndroid}>
            Add to Home Screen
          </button>
        )}

        <button style={{ ...s.dismissBtn, fontFamily: MONO }} onClick={dismiss}>maybe later</button>
      </div>
    </div>
  )
}

const s = {
  overlay: { position:'fixed', bottom:0, left:0, right:0, zIndex:9999, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end', justifyContent:'center' },
  sheet: { background:'#1a1a1e', borderRadius:'20px 20px 0 0', padding:'28px 24px 40px', width:'100%', maxWidth:480, border:'0.5px solid #252528', position:'relative' },
  closeBtn: { position:'absolute', top:16, right:16, background:'none', border:'none', color:'#888aa0', fontSize:18, cursor:'pointer', padding:4 },
  iconRow: { display:'flex', alignItems:'center', gap:14, marginBottom:16 },
  icon: { width:48, height:48, borderRadius:12, overflow:'hidden', flexShrink:0 },
  appName: { fontSize:18, fontWeight:700, color:'#ffffff', letterSpacing:'0.1em' },
  appSub: { fontSize:12, color:'#F5C518', marginTop:2 },
  desc: { fontSize:13, color:'#888aa0', lineHeight:1.6, marginBottom:20 },
  steps: { display:'flex', flexDirection:'column', gap:14, marginBottom:20 },
  step: { display:'flex', gap:12, alignItems:'flex-start' },
  stepNum: { width:26, height:26, borderRadius:8, background:'#F5C518', color:'#111114', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 },
  stepText: { fontSize:14, color:'#cccccc', lineHeight:1.5 },
  stepHint: { fontSize:12, color:'#888aa0' },
  iosNote: { fontSize:11, color:'#888aa0', background:'#111114', padding:'8px 12px', borderRadius:8, marginTop:4 },
  installBtn: { width:'100%', padding:'14px', background:'#F5C518', border:'none', borderRadius:12, color:'#111114', fontSize:16, fontWeight:700, cursor:'pointer', marginBottom:12 },
  dismissBtn: { width:'100%', padding:'12px', background:'none', border:'none', color:'#888aa0', fontSize:14, cursor:'pointer' }
}
