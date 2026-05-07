import { supabase } from './supabase'

// Generate a random 4-digit code
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Issue a new daily access code for a user
export async function issueAccessCode({ userId, clientId, permission, expiresAt }) {
  const code = generateCode()

  // Deactivate any existing active codes for this user today
  await supabase
    .from('access_codes')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)

  const { data, error } = await supabase
    .from('access_codes')
    .insert({
      code,
      user_id: userId,
      client_id: clientId,
      permission,
      expires_at: expiresAt,
      is_active: true
    })
    .select()
    .single()

  if (error) throw error

  // Log the event
  await supabase.from('audit_log').insert({
    event_type: 'code_issued',
    client_id: clientId,
    user_id: userId,
    access_code_id: data.id,
    meta: { permission, expires_at: expiresAt }
  })

  return { code, accessCodeId: data.id }
}

// Validate a code entered by a user on login
export async function validateAccessCode(code) {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('access_codes')
    .select(`
      *,
      users ( id, full_name, contact, contact_type ),
      clients ( id, username, full_name, profile_photo_url, online_start, online_end, timezone )
    `)
    .eq('code', code)
    .eq('is_active', true)
    .gt('expires_at', now)
    .single()

  if (error || !data) return { valid: false, reason: 'invalid_or_expired' }

  // Log login
  await supabase.from('audit_log').insert({
    event_type: 'login',
    client_id: data.client_id,
    user_id: data.user_id,
    access_code_id: data.id,
    meta: { code, permission: data.permission }
  })

  return {
    valid: true,
    session: {
      accessCodeId: data.id,
      permission: data.permission,
      expiresAt: data.expires_at,
      user: data.users,
      client: data.clients
    }
  }
}

// Revoke a code (admin action)
export async function revokeAccessCode(accessCodeId, reason = '') {
  const { data, error } = await supabase
    .from('access_codes')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: reason
    })
    .eq('id', accessCodeId)
    .select('*, users(full_name, contact, contact_type), clients(username)')
    .single()

  if (error) throw error

  // Log revocation
  await supabase.from('audit_log').insert({
    event_type: 'code_revoked',
    client_id: data.client_id,
    user_id: data.user_id,
    access_code_id: accessCodeId,
    meta: { reason }
  })

  return data
}

// Get all active codes for a client
export async function getActiveCodesForClient(clientId) {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('access_codes')
    .select('*, users(full_name, contact, contact_type)')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .gt('expires_at', now)
    .order('issued_at', { ascending: false })

  if (error) throw error
  return data
}
