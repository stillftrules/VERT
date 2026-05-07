import React, { useEffect, useState } from 'react'
import { getAllClients, getClientsByStatus, createClient, updateClientStatus, getUsersForClient, addUser } from '../lib/clients'
import { supabase } from '../lib/supabase'
import { issueAccessCode, getActiveCodesForClient, revokeAccessCode } from '../lib/accessCodes'
import { dispatchAccessCode } from '../lib/notifications'

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
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editUser, setEditUser] = useState({ fullName:'', contact:'' })
  const [newUser, setNewUser] = useState({ fullName:'', contact:'' })
  const [newClient, setNewClient] = useState({ username:'', fullName:'', email:'', phone:'', submittedBy:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [all, pending, outreach] = await Promise.all([
      getClientsByStatus('active'),
      getClientsByStatus('pending'),
      getClientsByStatus('outreach')
    ])
    setClients(all)
    setPendingClients(pending)
    setOutreachClients(outreach)
  }

  async function openClientPanel(client) {
    setPanelClient(client)
    setShowClientPanel(true)
    setShowAddUser(false)
    setNewUser({ fullName:'', contact:'', contactType:'email' })
    const users = await getUsersForClient(client.id)
    setPanelUsers(users)
  }

  async function handleDeleteUser(userId) {
    if (!window.confirm('Remove this user? This cannot be undone.')) return
    try {
      await supabase.from('users').update({ is_active: false }).eq('id', userId)
      setPanelUsers(prev => prev.filter(u => u.id !== userId))
    } catch(e) { console.error(e) }
  }

  function formatPhone(val) {
    const digits = val.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits.length ? '(' + digits : ''
    if (digits.length <= 6) return '(' + digits.slice(0,3) + ') ' + digits.slice(3)
    return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6)
  }

  function handlePhoneInput(val, setter, field) {
    const formatted = formatPhone(val)
    setter(p => ({...p, [field]: formatted}))
  }

  async function handleEditUser() {
    if (!editUser.fullName || !editUser.contact) return
    setSaving(true)
    try {
      await supabase
        .from('users')
        .update({ full_name: editUser.fullName, contact: editUser.contact, contact_type: 'email' })
        .eq('id', editingUser)
      const users = await getUsersForClient(panelClient.id)
      setPanelUsers(users)
      setEditingUser(null)
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function handleAddUser() {
    if (!newUser.fullName || !newUser.contact) return
    setSaving(true)
    try {
      await addUser({
        clientId: panelClient.id,
        fullName: newUser.fullName,
        contact: newUser.contact,
        contactType: 'email'
      })
      const users = await getUsersForClient(panelClient.id)
      setPanelUsers(users)
      setShowAddUser(false)
      setNewUser({ fullName:'', contact:'', contactType:'email' })
    } catch(e) {
      console.error(e)
    }
    setSaving(false)
  }

  async function selectClient(client) {
    setSelectedClient(client)
    setSelectedUsers([])
    setDispatchResult([])
    const [users, codes] = await Promise.all([
      getUsersForClient(client.id),
      getActiveCodesForClient(client.id)
    ])
    setClientUsers(users)
    setActiveCodes(codes)
    const perms = {}
    users.forEach(u => perms[u.id] = 'read_send')
    setUserPerms(perms)
  }

  function toggleUser(userId) {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  async function generateAndDispatch() {
    if (!selectedClient || selectedUsers.length === 0) return
    setDispatching(true)
    setDispatchResult([])
    const today = new Date()
    const [h, m] = expireTime.split(':')
    const expiresAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(h), parseInt(m))
    const results = []

    for (const userId of selectedUsers) {
      const user = clientUsers.find(u => u.id === userId)
      const permission = userPerms[userId] || 'read_send'
      try {
        const { code } = await issueAccessCode({ userId, clientId: selectedClient.id, permission, expiresAt: expiresAt.toISOString() })
        await dispatchAccessCode({ user, code, clientUsername: selectedClient.username, permission, expiresAt: expiresAt.toISOString() })
        results.push({ user, code, permission, status: 'sent' })
      } catch(e) {
        results.push({ user, code: '—', permission, status: 'failed', error: e.message })
      }
    }
    setDispatchResult(results)
    setSelectedUsers([])
    setDispatching(false)
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
      await createClient(newClient)
      setShowAddClient(false)
      setNewClient({ username:'', fullName:'', email:'', phone:'', submittedBy:'' })
      loadAll()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function advanceStatus(clientId, newStatus) {
    await updateClientStatus(clientId, newStatus)
    loadAll()
  }

  const permLabel = { read_send:'read + send', read_only:'read only', send_only:'send only' }
  const tabs = ['overview', 'pipeline', 'clients', 'codes']
  const initials = (str) => str ? str.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : '??'

  return (
    <div style={s.dash}>

      {/* CLIENT DETAIL PANEL */}
      {showClientPanel && panelClient && (
        <div style={s.overlay} onClick={() => setShowClientPanel(false)}>
          <div style={s.panel_slide} onClick={e => e.stopPropagation()}>
            <div style={s.panelHeader}>
              <div>
                <div style={s.panelTitle}>@{panelClient.username}</div>
                <div style={s.panelSub}>{panelClient.full_name}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setShowClientPanel(false)}>✕</button>
            </div>

            <div style={s.panelSection}>
              <div style={s.panelSectionHead}>
                <span style={s.sectionTitle}>users</span>
                <button style={s.addBtn} onClick={() => setShowAddUser(v => !v)}>+ add user</button>
              </div>

              {showAddUser && (
                <div style={s.addUserForm}>
                  <div style={s.formLabel}>full name</div>
                  <input style={s.formInput} placeholder="e.g. Marcus T." value={newUser.fullName} onChange={e => setNewUser(p => ({...p, fullName: e.target.value}))} />
                  <div style={s.formLabel}>email address</div>
                  <input style={s.formInput} placeholder="email@example.com" type="email" value={newUser.contact} onChange={e => setNewUser(p => ({...p, contact: e.target.value}))} />
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button style={{ ...s.addBtn, padding:'8px 16px' }} onClick={handleAddUser} disabled={saving}>
                      {saving ? 'saving...' : 'save user'}
                    </button>
                    <button style={{ ...s.addBtn, background:'#1a1a1e', color:'#888', border:'0.5px solid #2a2a2e' }} onClick={() => setShowAddUser(false)}>cancel</button>
                  </div>
                </div>
              )}

              {panelUsers.length === 0 && !showAddUser && (
                <div style={s.emptyState}>no users yet — add one above</div>
              )}

              {panelUsers.map(user => (
                <div key={user.id} style={{ ...s.userCard, flexDirection:'column', alignItems:'stretch' }}>
                  {editingUser === user.id ? (
                    <div>
                      <div style={s.formLabel}>full name</div>
                      <input style={s.formInput} value={editUser.fullName} onChange={e => setEditUser(p => ({...p, fullName: e.target.value}))} />
                      <div style={s.formLabel}>email address</div>
                      <input style={s.formInput} placeholder="email@example.com" type="email" value={editUser.contact} onChange={e => setEditUser(p => ({...p, contact: e.target.value}))} />
                      <div style={{ display:'flex', gap:8, marginTop:8 }}>
                        <button style={{ ...s.addBtn, padding:'6px 14px' }} onClick={handleEditUser} disabled={saving}>{saving ? 'saving...' : 'save'}</button>
                        <button style={{ ...s.addBtn, background:'#1a1a1e', color:'#888', border:'0.5px solid #2a2a2e', padding:'6px 14px' }} onClick={() => setEditingUser(null)}>cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ ...s.userAvatar, background:'#1e2d4a', color:'#378add' }}>{initials(user.full_name)}</div>
                      <div style={{ flex:1 }}>
                        <div style={s.userName}>{user.full_name}</div>
                        <div style={s.userContact}>
                          ✉ {user.contact}
                        </div>
                      </div>
                      <button style={s.editUserBtn} onClick={() => { setEditingUser(user.id); setEditUser({ fullName: user.full_name, contact: user.contact }) }}>edit</button>
                      <button style={s.deleteUserBtn} onClick={() => handleDeleteUser(user.id)}>remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding:'0 20px 20px' }}>
              <button style={{ ...s.addBtn, width:'100%', padding:12, fontSize:13 }}
                onClick={() => { setShowClientPanel(false); setTab('codes'); selectClient(panelClient) }}>
                go to code generation →
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={s.topbar}>
        <div style={s.topLeft}>
          <div style={s.logoSm}>💬</div>
          <span style={s.appTitle}>Vert</span>
          <span style={s.adminBadge}>super admin</span>
        </div>
        <span style={s.date}>{new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</span>
      </div>

      <div style={s.navTabs}>
        {tabs.map(t => (
          <div key={t} style={{ ...s.ntab, ...(tab === t ? s.ntabActive : {}) }} onClick={() => setTab(t)}>
            {t}
            {t === 'pipeline' && (pendingClients.length + outreachClients.length) > 0 && (
              <span style={s.tabBadge}>{pendingClients.length + outreachClients.length}</span>
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
                { label:'pending accounts', val: pendingClients.length + outreachClients.length, sub:'needs attention', warn: true },
                { label:'active codes today', val: activeCodes.length, sub:'across all accounts' },
                { label:'messages today', val: 0, sub:'today' },
              ].map(stat => (
                <div key={stat.label} style={s.statCard}>
                  <div style={s.statLabel}>{stat.label}</div>
                  <div style={s.statVal}>{stat.val}</div>
                  <div style={{ ...s.statSub, color: stat.warn ? '#e8a020' : '#1d9e75' }}>{stat.sub}</div>
                </div>
              ))}
            </div>
            {pendingClients.length > 0 && (
              <div style={s.panelBox}>
                <div style={s.panelBoxTitle}>needs attention</div>
                {pendingClients.map(c => (
                  <div key={c.id} style={{ ...s.clientRow, borderColor:'#e8a020' }}>
                    <div style={{ ...s.clAv, background:'#2a2010', color:'#e8a020' }}>{initials(c.full_name)}</div>
                    <div style={s.clInfo}>
                      <div style={s.clHandle}>{c.full_name}</div>
                      <div style={s.clName}>@{c.username} · submitted by {c.submitted_by}</div>
                      <div style={{ color:'#e8a020', fontSize:10, fontFamily:"'DM Mono',monospace" }}>pending outreach</div>
                    </div>
                    <button style={s.advanceBtn} onClick={() => advanceStatus(c.id, 'outreach')}>outreach made →</button>
                  </div>
                ))}
              </div>
            )}
            <div style={s.panelBox}>
              <div style={s.panelBoxTitle}>active clients</div>
              {clients.length === 0 && <div style={s.emptyState}>no active clients yet</div>}
              {clients.map(c => (
                <div key={c.id} style={s.clientRow} onClick={() => openClientPanel(c)}>
                  <div style={{ ...s.clAv, background:'#1e6a4a', color:'#5dcaa5' }}>{initials(c.username)}</div>
                  <div style={s.clInfo}>
                    <div style={s.clHandle}>@{c.username}</div>
                    <div style={s.clName}>{c.full_name}</div>
                  </div>
                  <span style={s.manageLink}>manage →</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PIPELINE */}
        {tab === 'pipeline' && (
          <>
            <div style={s.sectionHead}>
              <span style={s.sectionTitle}>client onboarding pipeline</span>
              <button style={s.addBtn} onClick={() => setShowAddClient(v => !v)}>+ add client</button>
            </div>
            {showAddClient && (
              <div style={s.panelBox}>
                <div style={s.panelBoxTitle}>new client</div>
                {[['Username (no spaces)','username'],['Full Name','fullName'],['Email','email'],['Phone','phone'],['Submitted By','submittedBy']].map(([label,key]) => (
                  <div key={key} style={{ marginBottom:8 }}>
                    <div style={s.formLabel}>{label}</div>
                    <input style={s.formInput} value={newClient[key]} onChange={e => setNewClient(p => ({...p,[key]:e.target.value}))} />
                  </div>
                ))}
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button style={s.addBtn} onClick={handleAddClient} disabled={saving}>{saving ? 'saving...' : 'save client'}</button>
                  <button style={{ ...s.addBtn, background:'#1a1a1e', color:'#888', border:'0.5px solid #2a2a2e' }} onClick={() => setShowAddClient(false)}>cancel</button>
                </div>
              </div>
            )}
            <div style={s.pipeline}>
              {[
                { label:'pending', color:'#e8a020', items: pendingClients, action:'outreach made →', nextStatus:'outreach' },
                { label:'outreach', color:'#378add', items: outreachClients, action:'activate →', nextStatus:'active' },
                { label:'activated', color:'#1d9e75', items: clients, action:null }
              ].map(col => (
                <div key={col.label} style={s.pipeCol}>
                  <div style={s.pipeColHead}>
                    <span style={{ ...s.pipeColTitle, color: col.color }}>{col.label}</span>
                    <span style={s.pipeCount}>{col.items.length}</span>
                  </div>
                  {col.items.length === 0 && <div style={s.pipeEmpty}>empty</div>}
                  {col.items.map(c => (
                    <div key={c.id} style={s.pipeCard}>
                      <div style={s.pipeCardName}>{c.full_name}</div>
                      <div style={s.pipeCardSub}>@{c.username}</div>
                      {c.submitted_by && <div style={s.submittedBy}>submitted by {c.submitted_by}</div>}
                      {col.action && (
                        <button style={{ ...s.pipeAction, background: col.nextStatus === 'active' ? '#1d9e75' : '#13201a', color: col.nextStatus === 'active' ? '#04342c' : '#1d9e75', border: col.nextStatus === 'active' ? 'none' : '0.5px solid #1d9e75' }}
                          onClick={() => advanceStatus(c.id, col.nextStatus)}>
                          {col.action}
                        </button>
                      )}
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
            <div style={s.sectionHead}>
              <span style={s.sectionTitle}>active clients ({clients.length})</span>
              <button style={s.addBtn} onClick={() => { setShowAddClient(true); setTab('pipeline') }}>+ add client</button>
            </div>
            {clients.length === 0 && <div style={s.emptyState}>no active clients yet — add one via the pipeline tab</div>}
            {clients.map(c => (
              <div key={c.id} style={s.clientRow} onClick={() => openClientPanel(c)}>
                <div style={{ ...s.clAv, background:'#1e6a4a', color:'#5dcaa5' }}>{initials(c.username)}</div>
                <div style={s.clInfo}>
                  <div style={s.clHandle}>@{c.username}</div>
                  <div style={s.clName}>{c.full_name}</div>
                </div>
                <span style={s.manageLink}>manage →</span>
              </div>
            ))}
          </>
        )}

        {/* CODES */}
        {tab === 'codes' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={s.panelBox}>
              <div style={s.panelBoxTitle}>step 1 · select client</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
                {clients.map(c => (
                  <div key={c.id}
                    style={{ ...s.chip, ...(selectedClient?.id === c.id ? s.chipSelected : {}) }}
                    onClick={() => selectClient(c)}>
                    @{c.username}
                  </div>
                ))}
              </div>

              {selectedClient && (
                <>
                  <div style={s.panelBoxTitle}>step 2 · select users</div>
                  {clientUsers.length === 0 && (
                    <div style={s.emptyState}>no users for this client yet —
                      <span style={{ color:'#1d9e75', cursor:'pointer' }} onClick={() => { setTab('clients'); openClientPanel(selectedClient) }}> add users first</span>
                    </div>
                  )}
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    {clientUsers.length > 0 && <button style={s.selAllBtn} onClick={() => setSelectedUsers(clientUsers.map(u => u.id))}>select all</button>}
                    <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:'#555' }}>{selectedUsers.length} selected</span>
                  </div>
                  {clientUsers.map(user => (
                    <div key={user.id}
                      style={{ ...s.userRow, ...(selectedUsers.includes(user.id) ? s.userRowChecked : {}) }}
                      onClick={() => toggleUser(user.id)}>
                      <div style={{ ...s.checkBox, ...(selectedUsers.includes(user.id) ? s.checkBoxChecked : {}) }}>
                        {selectedUsers.includes(user.id) && '✓'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{user.full_name}</div>
                        <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:'#555' }}>
                          {user.contact_type === 'email' ? '✉' : '📱'} {user.contact}
                        </div>
                      </div>
                      {selectedUsers.includes(user.id) && (
                        <select
                          style={s.permSelect}
                          value={userPerms[user.id]}
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
                      <div style={{ ...s.panelBoxTitle, marginTop:12 }}>step 3 · expiry time</div>
                      <select style={s.formInput} value={expireTime} onChange={e => setExpireTime(e.target.value)}>
                        <option value="18:00">6:00 PM ET</option>
                        <option value="20:00">8:00 PM ET</option>
                        <option value="23:00">11:00 PM ET</option>
                        <option value="23:59">midnight ET</option>
                      </select>
                      <button
                        style={{ ...s.addBtn, width:'100%', marginTop:12, padding:12, opacity: selectedUsers.length === 0 || dispatching ? 0.4 : 1 }}
                        disabled={selectedUsers.length === 0 || dispatching}
                        onClick={generateAndDispatch}>
                        {dispatching ? 'dispatching...' : `generate & send to ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`}
                      </button>
                    </>
                  )}

                  {dispatchResult.length > 0 && (
                    <div style={{ marginTop:12, background:'#13201a', border:'0.5px solid #1d9e75', borderRadius:10, padding:12 }}>
                      <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:'#5dcaa5', marginBottom:8 }}>✓ codes dispatched</div>
                      {dispatchResult.map((r,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'0.5px solid #1a2e22' }}>
                          <span style={{ flex:1, fontSize:12, fontWeight:600 }}>{r.user.full_name}</span>
                          <span style={{ fontSize:16, fontFamily:"'DM Mono',monospace", color:'#5dcaa5', letterSpacing:'0.2em' }}>{r.code}</span>
                          <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, fontFamily:"'DM Mono',monospace", background: r.user.contact_type === 'email' ? '#1e2535' : '#1e2e1e', color: r.user.contact_type === 'email' ? '#85b7eb' : '#639922' }}>{r.user.contact_type}</span>
                          <span style={{ color: r.status === 'sent' ? '#1d9e75' : '#e24b4a', fontSize:14 }}>{r.status === 'sent' ? '✓' : '✗'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={s.panelBox}>
              <div style={s.panelBoxTitle}>active codes today {selectedClient ? `· @${selectedClient.username}` : ''}</div>
              {activeCodes.length === 0 && <div style={s.emptyState}>no active codes</div>}
              {activeCodes.map(c => (
                <div key={c.id} style={s.codeItem}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{c.users?.full_name}</div>
                    <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:'#555' }}>
                      {permLabel[c.permission]} · exp {new Date(c.expires_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}
                    </div>
                  </div>
                  <div style={{ fontSize:18, fontFamily:"'DM Mono',monospace", color:'#5dcaa5', letterSpacing:'0.2em' }}>{c.code}</div>
                  <button style={s.revokeBtn} onClick={() => handleRevoke(c.id)}>revoke</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const s = {
  dash: { fontFamily:"'Syne',sans-serif", background:'#0e0e10', color:'#f0ede6', minHeight:'100vh', display:'flex', flexDirection:'column' },
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'0.5px solid #1e1e22' },
  topLeft: { display:'flex', alignItems:'center', gap:10 },
  logoSm: { width:30, height:30, borderRadius:8, background:'#1e6a4a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 },
  appTitle: { fontSize:15, fontWeight:700 },
  adminBadge: { fontSize:9, fontFamily:"'DM Mono',monospace", background:'#1a1a1e', border:'0.5px solid #2a2a2e', color:'#555', padding:'2px 8px', borderRadius:6, marginLeft:4 },
  date: { fontSize:12, color:'#555', fontFamily:"'DM Mono',monospace" },
  navTabs: { display:'flex', padding:'0 20px', borderBottom:'0.5px solid #1e1e22' },
  ntab: { padding:'11px 16px', fontSize:12, fontFamily:"'DM Mono',monospace", color:'#555', cursor:'pointer', borderBottom:'2px solid transparent' },
  ntabActive: { color:'#1d9e75', borderBottomColor:'#1d9e75' },
  tabBadge: { display:'inline-block', background:'#e24b4a', color:'#fff', fontSize:9, padding:'1px 5px', borderRadius:8, marginLeft:5 },
  content: { padding:20, flex:1 },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 },
  statCard: { background:'#161618', border:'0.5px solid #1e1e22', borderRadius:10, padding:'14px 16px' },
  statLabel: { fontSize:10, color:'#555', fontFamily:"'DM Mono',monospace", marginBottom:6 },
  statVal: { fontSize:22, fontWeight:700 },
  statSub: { fontSize:10, fontFamily:"'DM Mono',monospace", marginTop:3 },
  panelBox: { background:'#161618', border:'0.5px solid #1e1e22', borderRadius:10, padding:16, marginBottom:12 },
  panelBoxTitle: { fontSize:10, fontWeight:600, color:'#444', fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 },
  sectionHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#444', fontFamily:"'DM Mono',monospace", letterSpacing:'0.1em', textTransform:'uppercase' },
  addBtn: { background:'#1d9e75', border:'none', color:'#04342c', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600, padding:'6px 14px', borderRadius:8, cursor:'pointer' },
  clientRow: { background:'#1a1a1e', border:'0.5px solid #1e1e22', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, marginBottom:8, cursor:'pointer', transition:'border-color .12s' },
  clAv: { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 },
  clInfo: { flex:1 },
  clHandle: { fontSize:13, fontWeight:600 },
  clName: { fontSize:11, color:'#555', fontFamily:"'DM Mono',monospace" },
  manageLink: { color:'#1d9e75', fontSize:11, fontFamily:"'DM Mono',monospace", cursor:'pointer' },
  advanceBtn: { background:'#13201a', border:'0.5px solid #1d9e75', color:'#1d9e75', fontSize:10, fontFamily:"'DM Mono',monospace", padding:'4px 10px', borderRadius:5, cursor:'pointer' },
  emptyState: { fontSize:11, fontFamily:"'DM Mono',monospace", color:'#333', padding:'12px 0' },
  pipeline: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 },
  pipeCol: { background:'#131315', border:'0.5px solid #1e1e22', borderRadius:10, padding:12 },
  pipeColHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  pipeColTitle: { fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' },
  pipeCount: { fontSize:10, fontFamily:"'DM Mono',monospace", background:'#1a1a1e', padding:'1px 7px', borderRadius:8, color:'#555' },
  pipeCard: { background:'#1a1a1e', border:'0.5px solid #1e1e22', borderRadius:8, padding:'10px 12px', marginBottom:7 },
  pipeCardName: { fontSize:13, fontWeight:600, marginBottom:2 },
  pipeCardSub: { fontSize:10, fontFamily:"'DM Mono',monospace", color:'#555' },
  submittedBy: { fontSize:9, fontFamily:"'DM Mono',monospace", color:'#333', marginTop:3 },
  pipeAction: { fontSize:9, fontFamily:"'DM Mono',monospace", padding:'3px 8px', borderRadius:5, cursor:'pointer', marginTop:8 },
  pipeEmpty: { fontSize:11, fontFamily:"'DM Mono',monospace", color:'#333', textAlign:'center', padding:'16px 0' },
  chip: { padding:'6px 12px', background:'#1a1a1e', border:'0.5px solid #2a2a2e', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer' },
  chipSelected: { background:'#13201a', borderColor:'#1d9e75', color:'#5dcaa5' },
  selAllBtn: { fontSize:11, fontFamily:"'DM Mono',monospace", color:'#1d9e75', background:'none', border:'none', cursor:'pointer' },
  userRow: { background:'#1a1a1e', border:'0.5px solid #1e1e22', borderRadius:10, padding:'10px 12px', marginBottom:6, display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
  userRowChecked: { background:'#13201a', borderColor:'#1d9e75' },
  checkBox: { width:18, height:18, borderRadius:5, border:'1.5px solid #2a2a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#04342c', flexShrink:0 },
  checkBoxChecked: { background:'#1d9e75', borderColor:'#1d9e75' },
  permSelect: { background:'#1a1a1e', border:'0.5px solid #1d9e75', borderRadius:6, color:'#5dcaa5', fontFamily:"'DM Mono',monospace", fontSize:10, padding:'4px 6px', outline:'none' },
  formLabel: { fontSize:10, fontFamily:"'DM Mono',monospace", color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 },
  formInput: { background:'#1a1a1e', border:'0.5px solid #2a2a2e', borderRadius:8, color:'#f0ede6', fontFamily:"'DM Mono',monospace", fontSize:12, padding:'8px 10px', width:'100%', outline:'none', marginBottom:8, boxSizing:'border-box' },
  codeItem: { display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'0.5px solid #1a1a1e' },
  revokeBtn: { background:'none', border:'0.5px solid #2a1414', color:'#e24b4a', fontSize:10, fontFamily:"'DM Mono',monospace", padding:'3px 8px', borderRadius:5, cursor:'pointer' },
  editUserBtn: { background:'none', border:'0.5px solid #1d9e75', color:'#1d9e75', fontSize:10, fontFamily:"'DM Mono',monospace", padding:'3px 8px', borderRadius:5, cursor:'pointer', flexShrink:0 },
  deleteUserBtn: { background:'none', border:'0.5px solid #2a1414', color:'#e24b4a', fontSize:10, fontFamily:"'DM Mono',monospace", padding:'3px 8px', borderRadius:5, cursor:'pointer', flexShrink:0 },
  overlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', justifyContent:'flex-end' },
  panel_slide: { background:'#161618', width:420, maxWidth:'90vw', height:'100vh', overflowY:'auto', borderLeft:'0.5px solid #2a2a2e', display:'flex', flexDirection:'column' },
  panelHeader: { padding:'20px 20px 16px', borderBottom:'0.5px solid #1e1e22', display:'flex', alignItems:'flex-start', justifyContent:'space-between' },
  panelTitle: { fontSize:18, fontWeight:700 },
  panelSub: { fontSize:12, color:'#555', fontFamily:"'DM Mono',monospace", marginTop:3 },
  closeBtn: { background:'none', border:'none', color:'#555', fontSize:18, cursor:'pointer' },
  panelSection: { padding:'16px 20px', flex:1 },
  panelSectionHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  addUserForm: { background:'#1a1a1e', border:'0.5px solid #2a2a2e', borderRadius:10, padding:14, marginBottom:12 },
  userCard: { display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#1a1a1e', border:'0.5px solid #1e1e22', borderRadius:10, marginBottom:7 },
  userAvatar: { width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 },
  userName: { fontSize:13, fontWeight:600 },
  userContact: { fontSize:10, fontFamily:"'DM Mono',monospace", color:'#555', marginTop:2, display:'flex', alignItems:'center', gap:5 },
  contactBadge: { fontSize:9, padding:'1px 6px', borderRadius:4, fontFamily:"'DM Mono',monospace" },
}
