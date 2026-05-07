import { supabase } from './supabase'

// ============================================
// CLIENT MANAGEMENT
// ============================================

export async function getAllClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getClientsByStatus(status) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createClient({ username, fullName, email, phone, submittedBy }) {
  const { data, error } = await supabase
    .from('clients')
    .insert({
      username: username.toLowerCase().replace(/\s/g, ''),
      full_name: fullName,
      email,
      phone,
      submitted_by: submittedBy,
      status: 'pending'
    })
    .select()
    .single()

  if (error) throw error

  await supabase.from('audit_log').insert({
    event_type: 'client_signup',
    client_id: data.id,
    meta: { submitted_by: submittedBy, username: data.username }
  })

  return data
}

export async function updateClientStatus(clientId, status) {
  const updates = { status }
  if (status === 'active') updates.activated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)
    .select()
    .single()

  if (error) throw error

  if (status === 'active') {
    await supabase.from('audit_log').insert({
      event_type: 'client_activated',
      client_id: clientId,
      meta: {}
    })
  }

  return data
}

export async function updateClientProfile(clientId, updates) {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================
// USER MANAGEMENT (formerly team members)
// ============================================

export async function getUsersForClient(clientId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('full_name')
  if (error) throw error
  return data
}

export async function addUser({ clientId, fullName, contact, contactType }) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      client_id: clientId,
      full_name: fullName,
      contact,
      contact_type: contactType
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deactivateUser(userId) {
  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', userId)
  if (error) throw error
}

// ============================================
// AUDIT LOG
// ============================================

export async function getAuditLog({ clientId, limit = 50, eventType } = {}) {
  let query = supabase
    .from('audit_log')
    .select('*, clients(username), users(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (clientId) query = query.eq('client_id', clientId)
  if (eventType) query = query.eq('event_type', eventType)

  const { data, error } = await query
  if (error) throw error
  return data
}
