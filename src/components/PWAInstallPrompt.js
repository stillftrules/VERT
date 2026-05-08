import React, { useState, useEffect } from 'react'

const FONT = "'Clarity City', 'DM Mono', sans-serif"
const MONO = "'DM Mono', monospace"

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState(null)
  const [browser, setBrowser] = useState(null)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
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
    const isChrome = /CriOS|Chrome/.test(ua) && !/Edge/.test(ua)
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS/.test(ua)
    const isDuck = /DuckDuckGo/.test(ua)
    const isFirefox = /FxiOS|Firefox/.test(ua)

    if (isIOS) {
      const b = isDuck ? 'duck' : isChrome ? 'chrome' : isSafari ? 'safari' : 'other'
      setBrowser(b)
      setTimeout(() => { setPlatform('ios'); setShow(true) }, 4000)
    } else if (isAndroid) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setTimeout(() => { setPlatform('android'); setShow(true) }, 2000)
      })
      // Fallback for browsers that don't fire beforeinstallprompt
      const b = isDuck ? 'duck' : isChrome ? 'chrome' : 'other'
      setBrowser(b)
      setTimeout(() => { setPlatform('android-manual'); setShow(true) }, 4000)
    }
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

  const iosInstructions = {
    safari: [
      { step: '1', text: <>Tap the <strong style={{ color:'#F5C518' }}>Share</strong> button at the bottom of your screen <span style={{ color:'#888aa0', fontSize:12 }}>(box with arrow pointing up)</span></> },
      { step: '2', text: <>Scroll down and tap <strong style={{ color:'#F5C518' }}>"Add to Home Screen"</strong></> },
      { step: '3', text: <>Tap <strong style={{ color:'#F5C518' }}>"Add"</strong> in the top right corner</> },
    ],
    chrome: [
      { step: '1', text: <>Tap the <strong style={{ color:'#F5C518' }}>three dots menu</strong> (⋮) in the top right corner</> },
      { step: '2', text: <>Tap <strong style={{ color:'#F5C518' }}>"Add to Home Screen"</strong></> },
      { step: '3', text: <>Tap <strong style={{ color:'#F5C518' }}>"Add"</strong> to confirm</> },
    ],
    duck: [
      { step: '1', text: <>Tap the <strong style={{ color:'#F5C518' }}>three dots menu</strong> (⋮) at the bottom of your screen</> },
      { step: '2', text: <>Tap <strong style={{ color:'#F5C518' }}>"Add to Home Screen"</strong></> },
      { step: '3', text: <>Tap <strong style={{ color:'#F5C518' }}>"Add"</strong> to confirm</> },
    ],
    other: [
      { step: '1', text: <>Open your browser's <strong style={{ color:'#F5C518' }}>menu</strong> (usually ⋮ or Share button)</> },
      { step: '2', text: <>Look for <strong style={{ color:'#F5C518' }}>"Add to Home Screen"</strong></> },
      { step: '3', text: <>Tap <strong style={{ color:'#F5C518' }}>"Add"</strong> to confirm</> },
    ],
  }

  const steps = iosInstructions[browser] || iosInstructions.other

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
            {steps.map(({ step, text }) => (
              <div key={step} style={s.step}>
                <div style={s.stepNum}>{step}</div>
                <div style={s.stepText}>{text}</div>
              </div>
            ))}
          </div>
        )}

        {platform === 'android' && (
          <button style={{ ...s.installBtn, fontFamily: FONT }} onClick={installAndroid}>
            Add to Home Screen
          </button>
        )}

        {platform === 'android-manual' && (
          <div style={s.steps}>
            <div style={s.step}>
              <div style={s.stepNum}>1</div>
              <div style={s.stepText}>Tap the <strong style={{ color:'#F5C518' }}>three dots menu</strong> (⋮) in your browser</div>
            </div>
            <div style={s.step}>
              <div style={s.stepNum}>2</div>
              <div style={s.stepText}>Tap <strong style={{ color:'#F5C518' }}>"Add to Home Screen"</strong></div>
            </div>
            <div style={s.step}>
              <div style={s.stepNum}>3</div>
              <div style={s.stepText}>Tap <strong style={{ color:'#F5C518' }}>"Add"</strong> to confirm</div>
            </div>
          </div>
        )}

        <button style={{ ...s.dismissBtn, fontFamily: MONO }} onClick={dismiss}>maybe later</button>
      </div>

      {/* Crisp chat position fix */}
      <style>{`
        .crisp-client .cc-kv6t { bottom: 80px !important; right: 20px !important; }
        .crisp-client .cc-1xry { bottom: 80px !important; right: 20px !important; }
      `}</style>
    </div>
  )
}

const s = {
  overlay: { position:'fixed', bottom:0, left:0, right:0, zIndex:9999, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end', justifyContent:'center' },
  sheet: {
    background: 'linear-gradient(145deg, #1f1a00, #2a2200)',
    border: '1.5px solid #F5C518',
    boxShadow: '0 -4px 40px rgba(245,197,24,0.25)',
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
  appSub: { fontSize:12, color:'#F5C518', marginTop:2 },
  desc: { fontSize:13, color:'#cccccc', lineHeight:1.6, marginBottom:20 },
  steps: { display:'flex', flexDirection:'column', gap:14, marginBottom:20 },
  step: { display:'flex', gap:12, alignItems:'flex-start' },
  stepNum: { width:26, height:26, borderRadius:8, background:'#F5C518', color:'#111114', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 },
  stepText: { fontSize:14, color:'#ffffff', lineHeight:1.5 },
  installBtn: { width:'100%', padding:'14px', background:'#F5C518', border:'none', borderRadius:12, color:'#111114', fontSize:16, fontWeight:700, cursor:'pointer', marginBottom:12 },
  dismissBtn: { width:'100%', padding:'12px', background:'none', border:'none', color:'#888aa0', fontSize:14, cursor:'pointer' }
}
