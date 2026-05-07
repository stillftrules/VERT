import { supabase } from './supabase'

export async function getOrCreateConversation({ clientId, userId, contactUsername }) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .eq('contact_username', contactUsername)
    .single()

  if (existing) return existing

  const { data, error } = await supabase
    .from('conversations')
    .insert({ client_id: clientId, user_id: userId, contact_username: contactUsername })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUserConversations({ clientId, userId }) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw error
  return data || []
}

export async function getMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function sendMessage({ conversationId, clientId, sentByUserId, content, isTranscribed = false }) {
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      client_id: clientId,
      sender: 'user',
      sent_by_user_id: sentByUserId,
      content,
      is_transcribed: isTranscribed
    })
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('conversations')
    .update({ last_message: content, last_message_at: message.created_at })
    .eq('id', conversationId)

  await supabase.from('audit_log').insert({
    event_type: 'message_sent',
    client_id: clientId,
    user_id: sentByUserId,
    message_id: message.id,
    meta: { conversation_id: conversationId, is_transcribed: isTranscribed, preview: content.slice(0, 60) }
  })

  return message
}

export async function editMessage(messageId, newContent) {
  const { data, error } = await supabase
    .from('messages')
    .update({ content: newContent, is_edited: true, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteMessage(messageId) {
  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true })
    .eq('id', messageId)

  if (error) throw error
}

// Fixed: create channel first, add listener, then subscribe
export function subscribeToMessages(conversationId, onMessage) {
  const channel = supabase.channel(`messages:${conversationId}`)
  
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    },
    (payload) => onMessage(payload.new)
  )

  channel.subscribe()
  return channel
}

export function unsubscribeFromMessages(channel) {
  if (channel) supabase.removeChannel(channel)
}
