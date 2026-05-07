import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, code, clientUsername, permission, expiresAt } = await req.json()

    const permissionLabel = {
      read_send: 'Read & Send',
      read_only: 'Read Only',
      send_only: 'Send Only'
    }[permission] || permission

    const expiry = new Date(expiresAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York'
    })

    if (user.contact_type === 'email') {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': Deno.env.get('BREVO_API_KEY') || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Vert', email: Deno.env.get('BREVO_FROM_EMAIL') },
          to: [{ email: user.contact, name: user.full_name }],
          subject: `Your Vert access code: ${code}`,
          htmlContent: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0e0e10;color:#f0ede6;padding:32px;border-radius:12px;"><div style="margin-bottom:24px;"><span style="font-size:20px;font-weight:700;color:#f0ede6;">Vert</span></div><p style="color:#888;font-size:14px;margin-bottom:8px;">Hi ${user.full_name},</p><p style="color:#888;font-size:14px;margin-bottom:24px;">Your access code for today is ready.</p><div style="background:#13201a;border:1px solid #1d9e75;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;"><div style="font-size:40px;font-weight:700;letter-spacing:0.3em;color:#5dcaa5;font-family:monospace;">${code}</div></div><table style="width:100%;font-size:12px;color:#555;font-family:monospace;margin-bottom:24px;"><tr><td style="padding:4px 0;">Acting as</td><td style="text-align:right;color:#f0ede6;">@${clientUsername}</td></tr><tr><td style="padding:4px 0;">Permission</td><td style="text-align:right;color:#f0ede6;">${permissionLabel}</td></tr><tr><td style="padding:4px 0;">Expires</td><td style="text-align:right;color:#f0ede6;">${expiry} ET</td></tr></table><p style="color:#444;font-size:11px;font-family:monospace;text-align:center;">Do not share this code. It expires automatically.</p></div>`
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(`Brevo error: ${JSON.stringify(err)}`)
      }
    } else {
      const message = `Vert: Hi ${user.full_name}, your access code is ${code} (as @${clientUsername}, expires ${expiry} ET). Do not share.`
      const res = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: Deno.env.get('VONAGE_API_KEY'),
          api_secret: Deno.env.get('VONAGE_API_SECRET'),
          from: Deno.env.get('VONAGE_FROM_NUMBER'),
          to: user.contact.replace(/\D/g, ''),
          text: message
        })
      })
      const data = await res.json()
      if (data.messages[0].status !== '0') {
        throw new Error(`Vonage error: ${data.messages[0]['error-text']}`)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
