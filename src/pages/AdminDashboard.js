import React, { useEffect, useState } from 'react'
import { getAllClients, getClientsByStatus, createClient, updateClientStatus, getUsersForClient, addUser } from '../lib/clients'
import { issueAccessCode, getActiveCodesForClient, revokeAccessCode } from '../lib/accessCodes'
import { dispatchAccessCode } from '../lib/notifications'
import { supabase } from '../lib/supabase'
import { adminLogout } from '../components/AdminLogin'

const FONT = "'Clarity City','DM Mono',sans-serif"
const MONO = "'DM Mono',monospace"
const BG = '#111114'
const CARD = '#1a1a1e'
const BORDER = '#252528'
const NEU_CARD = '6px 6px 14px #0a0a0c, -3px -3px 8px #1e1e22'
const NEU_SM = '4px 4px 8px #0a0a0c, -2px -2px 6px #1e1e22'

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview')
  const [clients, setClients] = useState([])
  const [pendingClients, setPendingClients] = useState([])
  const [outreachClients, setOutreachClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientUsers, setClientUsers] = useState([])
  const [activeCodes, setActiveCodes] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [userPerms, setUserPerms] = useState({})
  const [expireTime, setExpireTime] = useState('23:00')
  const [dispatching, setDispatching] = useState(false)
  const [dispatchResult, setDispatchResult] = useState([])
  const [showAddClient, setShowAddClient] = useState(false)
  const [showClientPanel, setShowClientPanel] = useState(false)
  const [panelClient, setPanelClient] = useState(null)
  const [panelUsers, setPanelUsers] = useState([])
  const [panelRequests, setPanelRequests] = useState([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editUser, setEditUser] = useState({ fullName:'', contact:'' })
  const [newUser, setNewUser] = useState({ fullName:'', contact:'' })
  const [newClient, setNewClient] = useState({ username:'', fullName:'', submittedBy:'' })
  const [saving, setSaving] = useState(false)
  const [accessRequests, setAccessRequests] = useState([])
  const [pipelineDetail, setPipelineDetail] = useState(null)
  const [showHiddenRequests, setShowHiddenRequests] = useState(false)
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')

  useEffect(() => { loadAll(); loadRequests() }, [])

  async function loadAll() {
    const [all, pending, outreach] = await Promise.all([
      getClientsByStatus('active'),
      getClientsByStatus('pending'),
      getClientsByStatus('outreach')
    ])
    setClients(all); setPendingClients(pending); setOutreachClients(outreach)
  }

  async function loadRequests() {
    const { data } = await supabase.from('audit_log').select('*')
      .eq('event_type', 'access_request').order('created_at', { ascending: false }).limit(100)
    setAccessRequests(data || [])
  }

  async function updateRequestStatus(id, status) {
    await supabase.from('audit_log').update({ meta: { ...accessRequests.find(r=>r.id===id)?.meta, status } }).eq('id', id)
    setAccessRequests(prev => prev.map(r => r.id === id ? { ...r, meta: { ...r.meta, status } } : r))
  }

  async function hideRequest(id) {
    await supabase.from('audit_log').update({ meta: { ...accessRequests.find(r=>r.id===id)?.meta, hidden: true } }).eq('id', id)
    setAccessRequests(prev => prev.map(r => r.id === id ? { ...r, meta: { ...r.meta, hidden: true } } : r))
  }

  async function unhideRequest(id) {
    const req = accessRequests.find(r => r.id === id)
    const newMeta = { ...req?.meta }
    delete newMeta.hidden
    await supabase.from('audit_log').update({ meta: newMeta }).eq('id', id)
    setAccessRequests(prev => prev.map(r => r.id === id ? { ...r, meta: newMeta } : r))
  }

  async function openClientPanel(client) {
    setPanelClient(client); setShowClientPanel(true)
    setShowAddUser(false); setEditingUser(null); setEditingUsername(false)
    setNewUser({ fullName:'', contact:'' })
    const [users, requests] = await Promise.all([
      getUsersForClient(client.id),
      supabase.from('audit_log').select('*').eq('event_type', 'access_request').eq('client_id', client.id).order('created_at', { ascending: false })
    ])
    setPanelUsers(users)
    setPanelRequests(requests.data || [])
  }

  async function handleAddUser() {
    if (!newUser.fullName || !newUser.contact) return
    setSaving(true)
    try {
      await addUser({ clientId: panelClient.id, fullName: newUser.fullName, contact: newUser.contact, contactType: 'email' })
      const users = await getUsersForClient(panelClient.id)
      setPanelUsers(users); setShowAddUser(false); setNewUser({ fullName:'', contact:'' })
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function handleEditUser() {
    if (!editUser.fullName || !editUser.contact) return
    setSaving(true)
    try {
      await supabase.from('users').update({ full_name: editUser.fullName, contact: editUser.contact, contact_type: 'email' }).eq('id', editingUser)
      const users = await getUsersForClient(panelClient.id)
      setPanelUsers(users); setEditingUser(null)
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function handleDeleteUser(userId) {
    if (!window.confirm('Remove this user?')) return
    try {
      await supabase.from('users').update({ is_active: false }).eq('id', userId)
      setPanelUsers(prev => prev.filter(u => u.id !== userId))
    } catch(e) { console.error(e) }
  }

  async function handleRevokeClientAccess(userId) {
    if (!window.confirm('Revoke this user\'s access immediately?')) return
    try {
      await supabase.from('access_codes').update({ is_active: false, revoked_at: new Date().toISOString(), revoked_reason: 'Admin revoked' })
        .eq('user_id', userId).eq('client_id', panelClient.id).eq('is_active', true)
      const codes = await getActiveCodesForClient(panelClient.id)
      setActiveCodes(codes)
    } catch(e) { console.error(e) }
  }

  async function handleChangeUsername() {
    if (!newUsername || !panelClient) return
    setSaving(true)
    const oldUsername = panelClient.username
    const cleanNew = newUsername.toLowerCase().replace(/\s/g,'')
    try {
      await supabase.from('clients').update({ username: cleanNew }).eq('id', panelClient.id)
      const { data: convos } = await supabase.from('conversations').select('id, convo_key').ilike('convo_key', `%${oldUsername}%`)
      for (const convo of convos || []) {
        const newKey = convo.convo_key.split('::').map(p => p === oldUsername ? cleanNew : p).sort().join('::')
        await supabase.from('conversations').update({ convo_key: newKey, contact_username: newKey }).eq('id', convo.id)
      }
      setPanelClient(p => ({...p, username: cleanNew}))
      setEditingUsername(false); setNewUsername(''); loadAll()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function selectClient(client) {
    setSelectedClient(client); setSelectedUsers([]); setDispatchResult([])
    const [users, codes] = await Promise.all([getUsersForClient(client.id), getActiveCodesForClient(client.id)])
    setClientUsers(users); setActiveCodes(codes)
    const perms = {}; users.forEach(u => perms[u.id] = 'read_send'); setUserPerms(perms)
  }

  function toggleUser(userId) {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  async function generateAndDispatch() {
    if (!selectedClient || selectedUsers.length === 0) return
    setDispatching(true); setDispatchResult([])
    const today = new Date()
    const [h, m] = expireTime.split(':')
    const expiresAt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), parseInt(h) + 4, parseInt(m)))
    const results = []
    for (const userId of selectedUsers) {
      const user = clientUsers.find(u => u.id === userId)
      const permission = userPerms[userId] || 'read_send'
      try {
        const { code } = await issueAccessCode({ userId, clientId: selectedClient.id, permission, expiresAt: expiresAt.toISOString() })
        await new Promise(r => setTimeout(r, 1500))
        await dispatchAccessCode({ user, code, clientUsername: selectedClient.username, permission, expiresAt: expiresAt.toISOString() })
        results.push({ user, code, permission, status:'sent' })
      } catch(e) { results.push({ user, code:'—', permission, status:'failed', error: e.message }) }
    }
    setDispatchResult(results); setSelectedUsers([]); setDispatching(false)
    const codes = await getActiveCodesForClient(selectedClient.id)
    setActiveCodes(codes)
  }

  async function handleRevoke(codeId) {
    await revokeAccessCode(codeId, 'Revoked by admin')
    setActiveCodes(prev => prev.filter(c => c.id !== codeId))
  }

  async function handleAddClient() {
    if (!newClient.username || !newClient.fullName) return
    setSaving(true)
    try {
      await createClient(newClient); setShowAddClient(false)
      setNewClient({ username:'', fullName:'', submittedBy:'' }); loadAll()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function advanceStatus(clientId, newStatus) {
    await updateClientStatus(clientId, newStatus); loadAll()
  }

  const permLabel = { read_send:'read + send', read_only:'read only', send_only:'send only' }
  const tabs = ['overview','pipeline','clients','codes','requests']
  const initials = (str) => str ? str.slice(0,2).toUpperCase() : '??'

  const reqStatusColor = { contacted:'#85b7eb', approved:'#4caf50', denied:'#e24b4a' }
  const reqStatusBg = { contacted:'#1a2535', approved:'#0d1f0d', denied:'#2a1414' }

  return (
    <div style={{ ...s.dash, fontFamily: FONT }}>

      {/* PIPELINE DETAIL PANEL */}
      {pipelineDetail && (
        <div style={s.overlay} onClick={() => setPipelineDetail(null)}>
          <div style={s.slidePanel} onClick={e => e.stopPropagation()}>
            <div style={s.panelHead}>
              <div>
                <div style={s.panelTitle}>@{pipelineDetail.username}</div>
                <div style={{ ...s.panelSub, fontFamily: MONO }}>{pipelineDetail.full_name}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setPipelineDetail(null)}>✕</button>
            </div>
            <div style={s.panelBody}>
              {[
                ['Full Name', pipelineDetail.full_name],
                ['Username', '@' + pipelineDetail.username],
                ['ID Number', pipelineDetail.id_number],
                ['Submitted By', pipelineDetail.submitted_by_name || pipelineDetail.submitted_by],
                ['Status', pipelineDetail.status],
                ['Submitted', pipelineDetail.created_at ? new Date(pipelineDetail.created_at).toLocaleDateString() : '—'],
              ].map(([label, val]) => val ? (
                <div key={label} style={s.detailRow}>
                  <div style={{ ...s.detailLabel, fontFamily: MONO }}>{label}</div>
                  <div style={s.detailVal}>{val}</div>
                </div>
              ) : null)}
              {pipelineDetail.signup_note && (
                <div style={s.noteBox}>
                  <div style={{ ...s.detailLabel, fontFamily: MONO, marginBottom:6 }}>Note</div>
                  <div style={{ ...s.detailVal, color:'#ccc', lineHeight:1.5 }}>"{pipelineDetail.signup_note}"</div>
                </div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                {pipelineDetail.status === 'pending' && (
                  <button style={{ ...s.addBtn, boxShadow: NEU_SM, flex:1 }}
                    onClick={() => { advanceStatus(pipelineDetail.id, 'outreach'); setPipelineDetail(p => ({...p, status:'outreach'})) }}>
                    mark outreach made →
                  </button>
                )}
                {pipelineDetail.status === 'outreach' && (
                  <button style={{ ...s.addBtn, boxShadow: NEU_SM, flex:1 }}
                    onClick={() => { advanceStatus(pipelineDetail.id, 'active'); setPipelineDetail(null) }}>
                    activate client →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLIENT DETAIL PANEL */}
      {showClientPanel && panelClient && (
        <div style={s.overlay} onClick={() => setShowClientPanel(false)}>
          <div style={s.slidePanel} onClick={e => e.stopPropagation()}>
            <div style={s.panelHead}>
              <div style={{ flex:1 }}>
                {editingUsername ? (
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input style={{ ...s.formInput, margin:0, flex:1, fontSize:14 }} placeholder="new username"
                      value={newUsername} onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s/g,''))} autoFocus />
                    <button style={{ ...s.addBtn, padding:'6px 12px', boxShadow: NEU_SM }} onClick={handleChangeUsername} disabled={saving}>{saving ? '...' : 'save'}</button>
                    <button style={s.ghostBtn} onClick={() => { setEditingUsername(false); setNewUsername('') }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={s.panelTitle}>@{panelClient.username}</div>
                    <button style={{ ...s.editUserBtn, fontSize:9 }} onClick={() => { setEditingUsername(true); setNewUsername(panelClient.username) }}>edit username</button>
                  </div>
                )}
                <div style={{ ...s.panelSub, fontFamily: MONO }}>{panelClient.full_name}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setShowClientPanel(false)}>✕</button>
            </div>

            <div style={s.panelBody}>
              {/* Client info */}
              <div style={{ ...s.infoCard, boxShadow: NEU_SM }}>
                {[
                  ['ID Number', panelClient.id_number],
                  ['Submitted By', panelClient.submitted_by_name || panelClient.submitted_by],
                  ['Status', panelClient.status],
                  ['Joined', panelClient.created_at ? new Date(panelClient.created_at).toLocaleDateString() : '—'],
                ].map(([label, val]) => val ? (
                  <div key={label} style={s.infoRow}>
                    <div style={{ ...s.detailLabel, fontFamily: MONO }}>{label}</div>
                    <div style={s.detailVal}>{val}</div>
                  </div>
                ) : null)}
                {panelClient.signup_note && (
                  <div style={s.infoRow}>
                    <div style={{ ...s.detailLabel, fontFamily: MONO }}>Note</div>
                    <div style={{ ...s.detailVal, color:'#ccc' }}>"{panelClient.signup_note}"</div>
                  </div>
                )}
              </div>

              {/* Request history */}
              {panelRequests.length > 0 && (
                <>
                  <div style={{ ...s.sectionTitle, marginTop:16, marginBottom:8 }}>access request history</div>
                  {panelRequests.map(req => (
                    <div key={req.id} style={{ ...s.reqHistCard, boxShadow: NEU_SM }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{req.meta?.first_name}</div>
                        <div style={{ fontSize:10, fontFamily: MONO, color: reqStatusColor[req.meta?.status] || '#888aa0',
                          background: reqStatusBg[req.meta?.status] || '#1a1a1e',
                          padding:'2px 8px', borderRadius:6 }}>
                          {req.meta?.status || 'pending'}
                        </div>
                      </div>
                      {req.meta?.note && <div style={{ fontSize:12, color:'#888aa0', fontFamily: MONO }}>"{req.meta.note}"</div>}
                      <div style={{ fontSize:10, color:'#444', fontFamily: MONO, marginTop:4 }}>{new Date(req.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </>
              )}

              {/* Users */}
              <div style={s.panelSecHead}>
                <span style={s.sectionTitle}>users</span>
                <button style={{ ...s.addBtn, boxShadow: NEU_SM }} onClick={() => setShowAddUser(v => !v)}>+ add user</button>
              </div>

              {showAddUser && (
                <div style={{ ...s.formCard, boxShadow: NEU_SM }}>
                  <div style={{ ...s.formLabel, fontFamily: MONO }}>full name</div>
                  <input style={{ ...s.formInput, fontFamily: FONT }} placeholder="e.g. Marcus T."
                    value={newUser.fullName} onChange={e => setNewUser(p => ({...p, fullName: e.target.value}))} />
                  <div style={{ ...s.formLabel, fontFamily: MONO }}>email address</div>
                  <input style={{ ...s.formInput, fontFamily: MONO }} type="email" placeholder="email@example.com"
                    value={newUser.contact} onChange={e => setNewUser(p => ({...p, contact: e.target.value}))} />
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button style={{ ...s.addBtn, padding:'8px 16px', boxShadow: NEU_SM }} onClick={handleAddUser} disabled={saving}>
                      {saving ? 'saving...' : 'save user'}
                    </button>
                    <button style={s.ghostBtn} onClick={() => setShowAddUser(false)}>cancel</button>
                  </div>
                </div>
              )}

              {panelUsers.length === 0 && !showAddUser && <div style={{ ...s.emptyState, fontFamily: MONO }}>no users yet</div>}

              {panelUsers.map(user => (
                <div key={user.id} style={{ ...s.userCard, boxShadow: NEU_SM }}>
                  {editingUser === user.id ? (
                    <div style={{ width:'100%' }}>
                      <div style={{ ...s.formLabel, fontFamily: MONO }}>full name</div>
                      <input style={{ ...s.formInput, fontFamily: FONT }} value={editUser.fullName} onChange={e => setEditUser(p => ({...p, fullName: e.target.value}))} />
                      <div style={{ ...s.formLabel, fontFamily: MONO }}>email address</div>
                      <input style={{ ...s.formInput, fontFamily: MONO }} type="email" value={editUser.contact} onChange={e => setEditUser(p => ({...p, contact: e.target.value}))} />
                      <div style={{ display:'flex', gap:8, marginTop:8 }}>
                        <button style={{ ...s.addBtn, padding:'6px 14px', boxShadow: NEU_SM }} onClick={handleEditUser} disabled={saving}>{saving ? 'saving...' : 'save'}</button>
                        <button style={s.ghostBtn} onClick={() => setEditingUser(null)}>cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:10, width:'100%' }}>
                      <div style={s.userAvatar}>{initials(user.full_name)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={s.userName}>{user.full_name}</div>
                        <div style={{ ...s.userContact, fontFamily: MONO }}>✉ {user.contact}</div>
                      </div>
                      <button style={s.editUserBtn} onClick={() => { setEditingUser(user.id); setEditUser({ fullName: user.full_name, contact: user.contact }) }}>edit</button>
                      <button style={{ ...s.deleteUserBtn, borderColor:'#e8a02040', color:'#e8a020' }} onClick={() => handleRevokeClientAccess(user.id)}>revoke</button>
                      <button style={s.deleteUserBtn} onClick={() => handleDeleteUser(user.id)}>remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding:'0 20px 24px' }}>
              <button style={{ ...s.addBtn, width:'100%', padding:13, fontSize:14, boxShadow: NEU_SM }}
                onClick={() => { setShowClientPanel(false); setTab('codes'); selectClient(panelClient) }}>
                go to code generation →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOPBAR */}
      <div style={s.topbar}>
        <div style={s.topLeft}>
          <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill={CARD}/>
            <path d="M8 12C8 10.3431 9.34315 9 11 9H25C26.6569 9 28 10.3431 28 12V20C28 21.6569 26.6569 23 25 23H20L15 27V23H11C9.34315 23 8 21.6569 8 20V12Z" fill="#F5C518"/>
          </svg>
          <span style={s.appTitle}>BANQO</span>
          <span style={{ ...s.adminBadge, fontFamily: MONO }}>super admin</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ ...s.dateLabel, fontFamily: MONO }}>{new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</span>
          <button style={{ background:'none', border:`0.5px solid ${BORDER}`, color:'#888aa0', fontSize:11, fontFamily: MONO, padding:'4px 10px', borderRadius:6, cursor:'pointer' }} onClick={adminLogout}>sign out</button>
        </div>
      </div>

      {/* NAV TABS */}
      <div style={s.navTabs}>
        {tabs.map(t => (
          <div key={t} style={{ ...s.ntab, fontFamily: MONO, ...(tab === t ? s.ntabActive : {}) }} onClick={() => setTab(t)}>
            {t}
            {t === 'pipeline' && (pendingClients.length + outreachClients.length) > 0 && (
              <span style={s.tabBadge}>{pendingClients.length + outreachClients.length}</span>
            )}
            {t === 'requests' && accessRequests.filter(r => !r.meta?.status).length > 0 && (
              <span style={s.tabBadge}>{accessRequests.filter(r => !r.meta?.status).length}</span>
            )}
          </div>
        ))}
      </div>

      <div style={s.content}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            <div style={s.statsRow}>
              {[
                { label:'active clients', val: clients.length, sub:'total' },
                { label:'pending', val: pendingClients.length + outreachClients.length, sub:'needs attention', warn: true },
                { label:'active codes', val: activeCodes.length, sub:'today' },
                { label:'requests', val: accessRequests.filter(r => !r.meta?.status).length, sub:'unattended', warn: true },
              ].map(stat => (
                <div key={stat.label} style={{ ...s.statCard, boxShadow: NEU_CARD }}>
                  <div style={{ ...s.statLabel, fontFamily: MONO }}>{stat.label}</div>
                  <div style={s.statVal}>{stat.val}</div>
                  <div style={{ ...s.statSub, color: stat.warn && stat.val > 0 ? '#e8a020' : '#F5C518' }}>{stat.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ ...s.panel, boxShadow: NEU_CARD }}>
              <div style={{ ...s.panelTitle2, fontFamily: MONO }}>active clients</div>
              {clients.length === 0 && <div style={{ ...s.emptyState, fontFamily: MONO }}>no active clients yet</div>}
              {clients.map(c => (
                <div key={c.id} style={s.clientRow} onClick={() => openClientPanel(c)}>
                  <div style={{ ...s.clAv }}>{initials(c.username)}</div>
                  <div style={s.clInfo}>
                    <div style={s.clHandle}>@{c.username}</div>
                    <div style={{ ...s.clSub, fontFamily: MONO }}>{c.full_name}</div>
                  </div>
                  <span style={{ ...s.manageLink, fontFamily: MONO }}>manage →</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PIPELINE */}
        {tab === 'pipeline' && (
          <>
            <div style={s.secHead}>
              <span style={{ ...s.secLabel, fontFamily: MONO }}>client onboarding pipeline</span>
              <button style={{ ...s.addBtn, boxShadow: NEU_SM }} onClick={() => setShowAddClient(v => !v)}>+ add client</button>
            </div>
            {showAddClient && (
              <div style={{ ...s.panel, boxShadow: NEU_CARD }}>
                <div style={{ ...s.panelTitle2, fontFamily: MONO }}>new client</div>
                {[['Username (no spaces)','username'],['Full Name','fullName'],['Submitted By','submittedBy']].map(([label,key]) => (
                  <div key={key} style={{ marginBottom:10 }}>
                    <div style={{ ...s.formLabel, fontFamily: MONO }}>{label}</div>
                    <input style={{ ...s.formInput, fontFamily: key === 'username' ? MONO : FONT }}
                      value={newClient[key]} onChange={e => setNewClient(p => ({...p,[key]:e.target.value}))} />
                  </div>
                ))}
                <div style={{ display:'flex', gap:8 }}>
                  <button style={{ ...s.addBtn, boxShadow: NEU_SM }} onClick={handleAddClient} disabled={saving}>{saving ? 'saving...' : 'save client'}</button>
                  <button style={s.ghostBtn} onClick={() => setShowAddClient(false)}>cancel</button>
                </div>
              </div>
            )}
            <div style={s.pipeline}>
              {[
                { label:'pending', color:'#e8a020', items: pendingClients, nextStatus:'outreach' },
                { label:'outreach', color:'#85b7eb', items: outreachClients, nextStatus:'active' },
                { label:'activated', color:'#F5C518', items: clients, action:null }
              ].map(col => (
                <div key={col.label} style={{ ...s.pipeCol, boxShadow: NEU_CARD }}>
                  <div style={s.pipeColHead}>
                    <span style={{ ...s.pipeColTitle, fontFamily: MONO, color: col.color }}>{col.label}</span>
                    <span style={{ ...s.pipeCount, fontFamily: MONO }}>{col.items.length}</span>
                  </div>
                  {col.items.length === 0 && <div style={{ ...s.pipeEmpty, fontFamily: MONO }}>empty</div>}
                  {col.items.map(c => (
                    <div key={c.id} style={{ ...s.pipeCard, boxShadow: NEU_SM, cursor:'pointer' }} onClick={() => setPipelineDetail(c)}>
                      <div style={s.pipeCardName}>{c.full_name}</div>
                      <div style={{ ...s.pipeCardSub, fontFamily: MONO }}>@{c.username}</div>
                      {c.submitted_by && <div style={{ ...s.submittedBy, fontFamily: MONO }}>by {c.submitted_by_name || c.submitted_by}</div>}
                      <div style={{ ...s.viewDetails, fontFamily: MONO }}>tap to view details →</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* CLIENTS */}
        {tab === 'clients' && (
          <>
            <div style={s.secHead}>
              <span style={{ ...s.secLabel, fontFamily: MONO }}>active clients ({clients.length})</span>
              <button style={{ ...s.addBtn, boxShadow: NEU_SM }} onClick={() => { setShowAddClient(true); setTab('pipeline') }}>+ add client</button>
            </div>
            {clients.length === 0 && <div style={{ ...s.emptyState, fontFamily: MONO }}>no active clients — add via pipeline tab</div>}
            {clients.map(c => (
              <div key={c.id} style={{ ...s.clientRow, boxShadow: NEU_CARD, marginBottom:10 }} onClick={() => openClientPanel(c)}>
                <div style={s.clAv}>{initials(c.username)}</div>
                <div style={s.clInfo}>
                  <div style={s.clHandle}>@{c.username}</div>
                  <div style={{ ...s.clSub, fontFamily: MONO }}>{c.full_name}</div>
                </div>
                <span style={{ ...s.manageLink, fontFamily: MONO }}>manage →</span>
              </div>
            ))}
          </>
        )}

        {/* CODES */}
        {tab === 'codes' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={{ ...s.panel, boxShadow: NEU_CARD }}>
              <div style={{ ...s.panelTitle2, fontFamily: MONO }}>step 1 · select client</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
                {clients.map(c => (
                  <div key={c.id} style={{ ...s.chip, fontFamily: MONO, boxShadow: NEU_SM, ...(selectedClient?.id === c.id ? s.chipSelected : {}) }}
                    onClick={() => selectClient(c)}>@{c.username}</div>
                ))}
              </div>
              {selectedClient && (
                <>
                  <div style={{ ...s.panelTitle2, fontFamily: MONO }}>step 2 · select users</div>
                  {clientUsers.length === 0 && <div style={{ ...s.emptyState, fontFamily: MONO }}>no users for this client — <span style={{ color:'#F5C518', cursor:'pointer' }} onClick={() => { setTab('clients'); openClientPanel(selectedClient) }}>add users first</span></div>}
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    {clientUsers.length > 0 && <button style={{ ...s.selAllBtn, fontFamily: MONO }} onClick={() => setSelectedUsers(clientUsers.map(u => u.id))}>select all</button>}
                    <span style={{ fontSize:11, fontFamily: MONO, color:'#888aa0' }}>{selectedUsers.length} selected</span>
                  </div>
                  {clientUsers.map(user => (
                    <div key={user.id}
                      style={{ ...s.userRow, boxShadow: NEU_SM, ...(selectedUsers.includes(user.id) ? s.userRowChecked : {}) }}
                      onClick={() => toggleUser(user.id)}>
                      <div style={{ ...s.checkBox, ...(selectedUsers.includes(user.id) ? s.checkBoxChecked : {}) }}>
                        {selectedUsers.includes(user.id) && '✓'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{user.full_name}</div>
                        <div style={{ fontSize:11, fontFamily: MONO, color:'#888aa0' }}>✉ {user.contact}</div>
                      </div>
                      {selectedUsers.includes(user.id) && (
                        <select style={{ ...s.permSelect, fontFamily: MONO }} value={userPerms[user.id]}
                          onChange={e => setUserPerms(p => ({...p,[user.id]:e.target.value}))}
                          onClick={e => e.stopPropagation()}>
                          <option value="read_send">read + send</option>
                          <option value="read_only">read only</option>
                          <option value="send_only">send only</option>
                        </select>
                      )}
                    </div>
                  ))}
                  {clientUsers.length > 0 && (
                    <>
                      <div style={{ ...s.panelTitle2, fontFamily: MONO, marginTop:14 }}>step 3 · expiry time</div>
                      <select style={{ ...s.formInput, fontFamily: MONO }} value={expireTime} onChange={e => setExpireTime(e.target.value)}>
                        <option value="18:00">6:00 PM ET</option>
                        <option value="20:00">8:00 PM ET</option>
                        <option value="23:00">11:00 PM ET</option>
                        <option value="23:59">midnight ET</option>
                      </select>
                      <button style={{ ...s.addBtn, width:'100%', marginTop:12, padding:12, opacity: selectedUsers.length === 0 || dispatching ? 0.4 : 1, boxShadow: NEU_SM }}
                        disabled={selectedUsers.length === 0 || dispatching} onClick={generateAndDispatch}>
                        {dispatching ? 'dispatching...' : `generate & send to ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`}
                      </button>
                    </>
                  )}
                  {dispatchResult.length > 0 && (
                    <div style={{ marginTop:12, background:'#1a1600', border:'0.5px solid #F5C51840', borderRadius:12, padding:14 }}>
                      <div style={{ fontSize:12, fontFamily: MONO, color:'#F5C518', marginBottom:10 }}>✓ codes dispatched</div>
                      {dispatchResult.map((r,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'0.5px solid #2a1f05' }}>
                          <span style={{ flex:1, fontSize:12, fontWeight:600, color:'#fff' }}>{r.user.full_name}</span>
                          <span style={{ fontSize:18, fontFamily: MONO, color:'#F5C518', letterSpacing:'0.2em' }}>{r.code}</span>
                          <span style={{ color: r.status === 'sent' ? '#F5C518' : '#e24b4a', fontSize:14 }}>{r.status === 'sent' ? '✓' : '✗'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ ...s.panel, boxShadow: NEU_CARD }}>
              <div style={{ ...s.panelTitle2, fontFamily: MONO }}>active codes today {selectedClient ? `· @${selectedClient.username}` : ''}</div>
              {activeCodes.length === 0 && <div style={{ ...s.emptyState, fontFamily: MONO }}>no active codes</div>}
              {activeCodes.map(c => (
                <div key={c.id} style={{ ...s.codeItem, boxShadow: NEU_SM }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{c.users?.full_name}</div>
                    <div style={{ fontSize:11, fontFamily: MONO, color:'#888aa0' }}>{permLabel[c.permission]} · exp {new Date(c.expires_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div>
                  </div>
                  <div style={{ fontSize:20, fontFamily: MONO, color:'#F5C518', letterSpacing:'0.2em' }}>{c.code}</div>
                  <button style={s.revokeBtn} onClick={() => handleRevoke(c.id)}>revoke</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTS */}
        {tab === 'requests' && (() => {
          const visible = accessRequests.filter(r => !r.meta?.hidden)
          const hidden = accessRequests.filter(r => r.meta?.hidden)
          return (
            <>
              <div style={s.secHead}>
                <span style={{ ...s.secLabel, fontFamily: MONO }}>
                  access requests ({visible.length})
                </span>
                <div style={{ display:'flex', gap:8 }}>
                  {hidden.length > 0 && (
                    <button style={{ ...s.ghostBtn, fontSize:11, fontFamily: MONO }}
                      onClick={() => setShowHiddenRequests(v => !v)}>
                      {showHiddenRequests ? 'hide archived' : `show archived (${hidden.length})`}
                    </button>
                  )}
                  <button style={{ ...s.addBtn, boxShadow: NEU_SM }} onClick={loadRequests}>refresh</button>
                </div>
              </div>
              {visible.length === 0 && <div style={{ ...s.emptyState, fontFamily: MONO }}>no active requests</div>}
              {visible.map(req => (
                <div key={req.id} style={{ ...s.reqCard, boxShadow: NEU_CARD }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={s.clHandle}>{req.meta?.first_name} → <span style={{ color:'#F5C518' }}>@{req.meta?.client_username}</span></div>
                      <div style={{ fontSize:11, fontFamily: MONO, color:'#444', marginTop:2 }}>{new Date(req.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                      {['contacted','approved','denied'].map(status => (
                        <button key={status}
                          style={{ fontSize:10, fontFamily: MONO, padding:'3px 9px', borderRadius:6, cursor:'pointer', border:'none',
                            background: req.meta?.status === status ? reqStatusBg[status] : '#252528',
                            color: req.meta?.status === status ? reqStatusColor[status] : '#555',
                            fontWeight: req.meta?.status === status ? 700 : 400 }}
                          onClick={() => updateRequestStatus(req.id, status)}>
                          {status}
                        </button>
                      ))}
                      <button style={{ fontSize:10, fontFamily: MONO, padding:'3px 9px', borderRadius:6, cursor:'pointer', border:`0.5px solid ${BORDER}`, background:'none', color:'#444' }}
                        onClick={() => hideRequest(req.id)}>hide</button>
                    </div>
                  </div>
                  {req.meta?.note && <div style={{ ...s.noteBox, fontFamily: MONO }}>"{req.meta.note}"</div>}
                </div>
              ))}

              {showHiddenRequests && hidden.length > 0 && (
                <>
                  <div style={{ ...s.secLabel, fontFamily: MONO, marginTop:24, marginBottom:12, color:'#444' }}>archived ({hidden.length})</div>
                  {hidden.map(req => (
                    <div key={req.id} style={{ ...s.reqCard, boxShadow: NEU_CARD, opacity:0.5 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                        <div>
                          <div style={{ ...s.clHandle, color:'#888aa0' }}>{req.meta?.first_name} → @{req.meta?.client_username}</div>
                          <div style={{ fontSize:11, fontFamily: MONO, color:'#444', marginTop:2 }}>{new Date(req.created_at).toLocaleString()}</div>
                          {req.meta?.status && <div style={{ fontSize:10, fontFamily: MONO, color: reqStatusColor[req.meta.status] || '#888aa0', marginTop:2 }}>{req.meta.status}</div>}
                        </div>
                        <button style={{ fontSize:10, fontFamily: MONO, padding:'3px 9px', borderRadius:6, cursor:'pointer', border:`0.5px solid ${BORDER}`, background:'none', color:'#F5C518' }}
                          onClick={() => unhideRequest(req.id)}>restore</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}

const s = {
  dash: { background: BG, color:'#fff', minHeight:'100vh', display:'flex', flexDirection:'column' },
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:`0.5px solid ${BORDER}` },
  topLeft: { display:'flex', alignItems:'center', gap:12 },
  appTitle: { fontSize:16, fontWeight:700, color:'#fff', letterSpacing:'0.1em' },
  adminBadge: { fontSize:10, background: CARD, border:`0.5px solid ${BORDER}`, color:'#888aa0', padding:'3px 10px', borderRadius:6 },
  dateLabel: { fontSize:12, color:'#888aa0' },
  navTabs: { display:'flex', padding:'0 24px', borderBottom:`0.5px solid ${BORDER}` },
  ntab: { padding:'12px 18px', fontSize:12, color:'#888aa0', cursor:'pointer', borderBottom:'2px solid transparent' },
  ntabActive: { color:'#F5C518', borderBottomColor:'#F5C518' },
  tabBadge: { display:'inline-block', background:'#e24b4a', color:'#fff', fontSize:9, padding:'1px 5px', borderRadius:8, marginLeft:5 },
  content: { padding:24, flex:1 },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 },
  statCard: { background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:12, padding:'14px 16px' },
  statLabel: { fontSize:10, color:'#888aa0', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.1em' },
  statVal: { fontSize:24, fontWeight:700 },
  statSub: { fontSize:11, marginTop:4 },
  panel: { background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:14, padding:18, marginBottom:14 },
  panelTitle2: { fontSize:10, fontWeight:600, color:'#888aa0', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:14 },
  secHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  secLabel: { fontSize:11, fontWeight:600, color:'#888aa0', letterSpacing:'0.12em', textTransform:'uppercase' },
  sectionTitle: { fontSize:10, fontWeight:600, color:'#888aa0', letterSpacing:'0.12em', textTransform:'uppercase' },
  addBtn: { background:'#F5C518', border:'none', color:'#111114', fontSize:12, fontWeight:700, padding:'7px 16px', borderRadius:8, cursor:'pointer' },
  ghostBtn: { background:'none', border:`0.5px solid ${BORDER}`, color:'#888aa0', fontSize:12, padding:'7px 14px', borderRadius:8, cursor:'pointer' },
  clientRow: { background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:12, padding:'13px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', marginBottom:8 },
  clAv: { width:36, height:36, borderRadius:10, background:'#2a1f05', color:'#F5C518', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 },
  clInfo: { flex:1 },
  clHandle: { fontSize:14, fontWeight:700, color:'#fff' },
  clSub: { fontSize:11, color:'#888aa0', marginTop:2 },
  manageLink: { color:'#F5C518', fontSize:12, cursor:'pointer' },
  emptyState: { fontSize:12, color:'#444', padding:'12px 0' },
  pipeline: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 },
  pipeCol: { background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:14, padding:14 },
  pipeColHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  pipeColTitle: { fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' },
  pipeCount: { fontSize:10, background: BG, padding:'2px 8px', borderRadius:8, color:'#888aa0' },
  pipeCard: { background: BG, border:`0.5px solid ${BORDER}`, borderRadius:10, padding:'11px 12px', marginBottom:8 },
  pipeCardName: { fontSize:13, fontWeight:700, color:'#fff', marginBottom:2 },
  pipeCardSub: { fontSize:11, color:'#888aa0' },
  submittedBy: { fontSize:10, color:'#444', marginTop:3 },
  viewDetails: { fontSize:10, color:'#F5C518', marginTop:6 },
  pipeEmpty: { fontSize:11, color:'#333', textAlign:'center', padding:'20px 0' },
  chip: { padding:'7px 14px', background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', color:'#888aa0' },
  chipSelected: { background:'#2a1f05', borderColor:'#F5C518', color:'#F5C518' },
  selAllBtn: { fontSize:11, color:'#F5C518', background:'none', border:'none', cursor:'pointer' },
  userRow: { background: BG, border:`0.5px solid ${BORDER}`, borderRadius:10, padding:'10px 12px', marginBottom:7, display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
  userRowChecked: { background:'#1a1600', borderColor:'#F5C518' },
  checkBox: { width:18, height:18, borderRadius:5, border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#111114', flexShrink:0 },
  checkBoxChecked: { background:'#F5C518', borderColor:'#F5C518' },
  permSelect: { background: CARD, border:'0.5px solid #F5C51840', borderRadius:6, color:'#F5C518', fontSize:10, padding:'4px 6px', outline:'none' },
  formLabel: { fontSize:10, color:'#888aa0', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5 },
  formInput: { background: BG, border:`0.5px solid ${BORDER}`, borderRadius:8, color:'#fff', fontSize:13, fontWeight:200, padding:'9px 12px', width:'100%', outline:'none', marginBottom:10, boxSizing:'border-box', caretColor:'#F5C518' },
  codeItem: { display:'flex', alignItems:'center', gap:10, padding:'11px 12px', background: BG, border:`0.5px solid ${BORDER}`, borderRadius:10, marginBottom:8 },
  revokeBtn: { background:'none', border:'0.5px solid #e24b4a40', color:'#e24b4a', fontSize:10, padding:'4px 10px', borderRadius:6, cursor:'pointer' },
  overlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', justifyContent:'flex-end' },
  slidePanel: { background: CARD, width:420, maxWidth:'90vw', height:'100vh', overflowY:'auto', borderLeft:`0.5px solid ${BORDER}`, display:'flex', flexDirection:'column' },
  panelHead: { padding:'22px 20px 16px', borderBottom:`0.5px solid ${BORDER}`, display:'flex', alignItems:'flex-start', justifyContent:'space-between' },
  panelTitle: { fontSize:20, fontWeight:700, color:'#fff' },
  panelSub: { fontSize:12, color:'#888aa0', marginTop:4 },
  closeBtn: { background:'none', border:'none', color:'#888aa0', fontSize:18, cursor:'pointer' },
  panelBody: { padding:'16px 20px', flex:1 },
  panelSecHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, marginTop:16 },
  formCard: { background: BG, border:`0.5px solid ${BORDER}`, borderRadius:12, padding:14, marginBottom:12 },
  userCard: { background: BG, border:`0.5px solid ${BORDER}`, borderRadius:10, padding:'11px 12px', marginBottom:8, display:'flex', alignItems:'center' },
  userAvatar: { width:32, height:32, borderRadius:8, background:'#2a1f05', color:'#F5C518', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 },
  userName: { fontSize:13, fontWeight:600, color:'#fff' },
  userContact: { fontSize:11, color:'#888aa0', marginTop:2 },
  editUserBtn: { background:'none', border:'0.5px solid #F5C51840', color:'#F5C518', fontSize:10, padding:'3px 8px', borderRadius:6, cursor:'pointer', flexShrink:0 },
  deleteUserBtn: { background:'none', border:'0.5px solid #e24b4a40', color:'#e24b4a', fontSize:10, padding:'3px 8px', borderRadius:6, cursor:'pointer', flexShrink:0 },
  infoCard: { background: BG, border:`0.5px solid ${BORDER}`, borderRadius:12, padding:'12px 14px' },
  infoRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'6px 0', borderBottom:`0.5px solid ${BORDER}` },
  detailRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'8px 0', borderBottom:`0.5px solid ${BORDER}` },
  detailLabel: { fontSize:11, color:'#888aa0', flexShrink:0, marginRight:12 },
  detailVal: { fontSize:13, fontWeight:600, color:'#fff', textAlign:'right' },
  noteBox: { background: BG, border:`0.5px solid ${BORDER}`, borderRadius:8, padding:'10px 12px', marginTop:8, fontSize:12, color:'#888aa0', lineHeight:1.5 },
  reqCard: { background: CARD, border:`0.5px solid ${BORDER}`, borderRadius:12, padding:'14px 16px', marginBottom:10 },
  reqHistCard: { background: BG, border:`0.5px solid ${BORDER}`, borderRadius:10, padding:'10px 12px', marginBottom:8 },
}
