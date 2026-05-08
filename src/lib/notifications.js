// ============================================
// BANQO - Notification Delivery Service
// Routes through Supabase Edge Function
// ============================================

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY

export async function dispatchAccessCode({ user, code, clientUsername, permission, expiresAt }) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ user, code, clientUsername, permission, expiresAt })
  })

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Failed to dispatch code')
  }

  return data
}
