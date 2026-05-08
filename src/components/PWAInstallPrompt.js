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
    const isDuck = /DuckDuckGo/.test(ua)
    const isChrome = /CriOS|Chrome/.test(ua) && !/Edge|DuckDuckGo/.test(ua)
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|DuckDuckGo/.test(ua)

    if (isIOS) {
      const b = isDuck ? 'duck' : isChrome ? 'chrome-ios' : isSafari ? 'safari' : 'other'
      setBrowser(b)
      setTimeout(() => { setPlatform('ios'); setShow(true) }, 4000)
    } else if (isAndroid) {
      const b = isDuck ? 'duck-android' : isChrome ? 'chrome-android' : 'other-android'
      setBrowser(b)
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        setDeferredPrompt(e)
      })
      setTimeout(() => { setPlatform('android'); setShow(true) }, 3000)
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

  // Share icon (vertical and horizontal)
  const ShareIcons = () => (
    <div style={{ display:'flex', gap:12, margin:'10px 0 6px', alignItems:'center' }}>
      {/* Vertical share icon (Safari/iOS style) */}
      <div style={{ textAlign:'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        <div style={{ fontSize:9, color:'#888aa0', marginTop:2 }}>vertical</div>
      </div>
      <div style={{ color:'#555', fontSize:12 }}>or</div>
      {/* Horizontal share icon (Chrome style) */}
      <div style={{ textAlign:'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        <div style={{ fontSize:9, color:'#888aa0', marginTop:2 }}>horizontal</div>
      </div>
      <div style={{ fontSize:12, color:'#aaa', marginLeft:4 }}>Look for either of these in your browser</div>
    </div>
  )

  const instructions = {
    safari: {
      title: 'You\'re on Safari',
      steps: [
        { n:'1', text: <><strong style={{color:'#F5C518'}}>Tap the Share button</strong> at the bottom of your screen <ShareIcons /></> },
        { n:'2', text: <>Scroll down and tap <strong style={{color:'#F5C518'}}>"Add to Home Screen"</strong></> },
        { n:'3', text: <>Tap <strong style={{color:'#F5C518'}}>"Add"</strong> in the top right</> },
      ]
    },
    'chrome-ios': {
      title: 'You\'re on Chrome',
      steps: [
        { n:'1', text: <><strong style={{color:'#F5C518'}}>Tap the Share button</strong> in your browser bar <ShareIcons /></> },
        { n:'2', text: <>Scroll and tap <strong style={{color:'#F5C518'}}>"Add to Home Screen"</strong></> },
        { n:'3', text: <>Tap <strong style={{color:'#F5C518'}}>"Add"</strong> to confirm</> },
      ]
    },
    duck: {
      title: 'You\'re on DuckDuckGo',
      steps: [
        { n:'1', text: <><strong style={{color:'#F5C518'}}>Tap the Share button</strong> at the bottom <ShareIcons /></> },
        { n:'2', text: <>Tap <strong style={{color:'#F5C518'}}>"Add to Home Screen"</strong></> },
        { n:'3', text: <>Tap <strong style={{color:'#F5C518'}}>"Add"</strong> to confirm</> },
      ]
    },
    other: {
      title: 'Add to Home Screen',
      steps: [
        { n:'1', text: <><strong style={{color:'#F5C518'}}>Tap your browser's Share button</strong> <ShareIcons /></> },
        { n:'2', text: <>Look for <strong style={{color:'#F5C518'}}>"Add to Home Screen"</strong></> },
        { n:'3', text: <>Tap <strong style={{color:'#F5C518'}}>"Add"</strong> to confirm</> },
      ]
    },
    'chrome-android': {
      title: 'You\'re on Chrome',
      steps: [
        { n:'1', text: <><strong style={{color:'#F5C518'}}>Tap the Share button</strong> in your Chrome browser bar <ShareIcons /></> },
        { n:'2', text: <>Tap <strong style={{color:'#F5C518'}}>"Add to Home Screen"</strong></> },
        { n:'3', text: <>Tap <strong style={{color:'#F5C518'}}>"Add"</strong> to confirm</> },
      ]
    },
    'duck-android': {
      title: 'You\'re on DuckDuckGo',
      steps: [
        { n:'1', text: <><strong style={{color:'#F5C518'}}>Tap the Share button</strong> <ShareIcons /></> },
        { n:'2', text: <>Tap <strong style={{color:'#F5C518'}}>"Add to Home Screen"</strong></> },
        { n:'3', text: <>Tap <strong style={{color:'#F5C518'}}>"Add"</strong> to confirm</> },
      ]
    },
    'other-android': {
      title: 'Add to Home Screen',
      steps: [
        { n:'1', text: <><strong style={{color:'#F5C518'}}>Tap your browser's Share button</strong> <ShareIcons /></> },
        { n:'2', text: <>Look for <strong style={{color:'#F5C518'}}>"Add to Home Screen"</strong></> },
        { n:'3', text: <>Tap <strong style={{color:'#F5C518'}}>"Add"</strong> to confirm</> },
      ]
    },
  }

  const current = instructions[browser] || instructions.other
  const canAutoInstall = platform === 'android' && deferredPrompt

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
            <div style={{ ...s.appSub, fontFamily: MONO }}>{current.title}</div>
          </div>
        </div>

        <div style={{ ...s.desc, fontFamily: MONO }}>
          Get the full app experience — add Banqo to your home screen for instant access.
        </div>

        {canAutoInstall ? (
          <button style={{ ...s.installBtn, fontFamily: FONT }} onClick={installAndroid}>
            Add to Home Screen
          </button>
        ) : (
          <div style={s.steps}>
            {current.steps.map(({ n, text }) => (
              <div key={n} style={s.step}>
                <div style={s.stepNum}>{n}</div>
                <div style={s.stepText}>{text}</div>
              </div>
            ))}
          </div>
        )}

        <button style={{ ...s.dismissBtn, fontFamily: MONO }} onClick={dismiss}>maybe later</button>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position:'fixed', bottom:0, left:0, right:0, zIndex:9999,
    background:'rgba(0,0,0,0.85)',
    display:'flex', alignItems:'flex-end', justifyContent:'center'
  },
  sheet: {
    background: '#0a2a1a',
    border: '2px solid #00e676',
    boxShadow: '0 -8px 48px rgba(0,230,118,0.3)',
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
  appSub: { fontSize:12, color:'#00e676', marginTop:2 },
  desc: { fontSize:13, color:'#cccccc', lineHeight:1.6, marginBottom:20 },
  steps: { display:'flex', flexDirection:'column', gap:16, marginBottom:20 },
  step: { display:'flex', gap:12, alignItems:'flex-start' },
  stepNum: { width:26, height:26, borderRadius:8, background:'#00e676', color:'#000', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 },
  stepText: { fontSize:14, color:'#ffffff', lineHeight:1.6 },
  installBtn: { width:'100%', padding:'14px', background:'#00e676', border:'none', borderRadius:12, color:'#000', fontSize:16, fontWeight:700, cursor:'pointer', marginBottom:12 },
  dismissBtn: { width:'100%', padding:'12px', background:'none', border:'none', color:'#888aa0', fontSize:14, cursor:'pointer' }
}
