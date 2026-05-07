# Vert — your team, one voice

A managed messaging PWA where clients own a username and authorized users relay messages on their behalf using daily access codes.

---

## Stack
- **React** (PWA)
- **Supabase** (database + real-time)
- **Resend** (email delivery)
- **Vonage** (SMS delivery)

---

## Setup

### 1. Run the database schema
- Go to your Supabase project → SQL Editor
- Paste the contents of `supabase_schema.sql` and run it

### 2. Configure environment variables
- Copy `.env` and fill in your Vonage credentials when ready
- All other credentials are already set

### 3. Install and run
```bash
npm install
npm start
```

### 4. Access the app
- **User app:** `http://localhost:3000` (access code login)
- **Admin dashboard:** `http://localhost:3000/admin`

---

## Deployment (when ready)
Recommended: **Vercel** (free tier, automatic PWA support)
```bash
npm install -g vercel
vercel
```
Set your environment variables in Vercel dashboard → Settings → Environment Variables.

---

## Key flows

### User login
1. User opens app → enters 4-digit access code
2. Code validated against Supabase → session stored locally
3. Session auto-expires when code expires

### Code generation (admin)
1. Admin selects client → selects users → sets permissions + expiry
2. Unique codes generated → dispatched via email or SMS
3. Full audit trail recorded

### Messaging
- Each user has their own thread per contact
- Real-time via Supabase subscriptions
- Voice messages transcribed before sending
- Edit/delete for all parties
