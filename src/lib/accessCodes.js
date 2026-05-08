import { supabase } from './supabase'

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export async function issueAccessCode({ userId, clientId, permission, expiresAt }) {
  const code = generateCode()
  await supabase.from('access_codes').update({ is_active: false }).eq('user_id', userId).eq('is_active', true)
  const { data, error } = await supabase.from('access_codes').insert({ code, user_id: userId, client_id: clientId, permission, expires_at: expiresAt, is_active: true }).select().single()
  if (error) throw error
  await supabase.from('audit_log').insert({ event_type: 'code_issued', client_id: clientId, user_id: userId, access_code_id: data.id, meta: { permission, expires_at: expiresAt } })
  return { code, accessCodeId: data.id }
}

export async function validateAccessCode(code) {
  const now = new Date().toISOString()
  const { data: ac, error: acErr } = await supabase.from('access_codes').select('*').eq('code', code).eq('is_active', true).gt('expires_at', now).single()
  if (acErr || !ac) return { valid: false, reason: 'invalid_or_expired' }
  const { data: user } = await supabase.from('users').select('id, full_name, contact, contact_type').eq('id', ac.user_id).single()
  const { data: client } = await supabase.from('clients').select('id, username, full_name, profile_photo_url').eq('id', ac.client_id).single()
  if (!user || !client) return { valid: false, reason: 'user_or_client_not_found' }
  await supabase.from('audit_log').insert({ event_type: 'login', client_id: ac.client_id, user_id: ac.user_id, access_code_id: ac.id, meta: { code, permission: ac.permission } })
  return { valid: true, session: { accessCodeId: ac.id, permission: ac.permission, expiresAt: ac.expires_at, user, client } }
}

export async function revokeAccessCode(accessCodeId, reason = '') {
  const { data, error } = await supabase.from('access_codes').update({ is_active: false, revoked_at: new Date().toISOString(), revoked_reason: reason }).eq('id', accessCodeId).select('*, users(full_name, contact, contact_type), clients(username)').single()
  if (error) throw error
  await supabase.from('audit_log').insert({ event_type: 'code_revoked', client_id: data.client_id, user_id: data.user_id, access_code_id: accessCodeId, meta: { reason } })
  return data
}

export async function getActiveCodesForClient(clientId) {
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('access_codes').select('*, users(full_name, contact, contact_type)').eq('client_id', clientId).eq('is_active', true).gt('expires_at', now).order('issued_at', { ascending: false })
  if (error) throw error
  return data
}
