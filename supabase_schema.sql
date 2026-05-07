-- ============================================
-- VERT DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- CLIENTS (username owners - your paying customers)
create table clients (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  full_name text not null,
  email text,
  phone text,
  profile_photo_url text,
  status text default 'pending' check (status in ('pending', 'outreach', 'active', 'suspended')),
  submitted_by text,
  online_start time default '07:00:00',
  online_end time default '23:00:00',
  timezone text default 'America/New_York',
  membership_plan text default 'flat',
  created_at timestamptz default now(),
  activated_at timestamptz
);

-- USERS (people who get daily access codes - formerly "team members")
create table users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  contact text not null,         -- email or phone number
  contact_type text not null check (contact_type in ('email', 'phone')),
  client_id uuid references clients(id) on delete cascade,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ACCESS CODES (daily temporary codes issued to users)
create table access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid references users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  permission text not null check (permission in ('read_send', 'read_only', 'send_only')),
  expires_at timestamptz not null,
  is_active boolean default true,
  issued_at timestamptz default now(),
  revoked_at timestamptz,
  revoked_reason text
);

-- CONTACTS (people messaging the client's username - also Vert clients)
create table contacts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  full_name text,
  client_id uuid references clients(id) on delete cascade,
  created_at timestamptz default now(),
  unique(client_id, username)
);

-- CONVERSATIONS (each user has their own thread per contact)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  contact_username text not null,
  last_message text,
  last_message_at timestamptz,
  unread_count int default 0,
  created_at timestamptz default now(),
  unique(client_id, user_id, contact_username)
);

-- MESSAGES
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  sender text not null check (sender in ('user', 'contact')),
  sent_by_user_id uuid references users(id) on delete set null,
  content text not null,
  is_transcribed boolean default false,
  is_edited boolean default false,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  edited_at timestamptz
);

-- AUDIT LOG (every action tracked)
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,      -- 'login', 'logout', 'message_sent', 'code_issued', 'code_revoked', 'client_signup', 'client_activated'
  client_id uuid references clients(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  access_code_id uuid references access_codes(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  meta jsonb,                    -- any extra details
  created_at timestamptz default now()
);

-- ADMIN USERS (your internal super admin team)
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  role text default 'admin' check (role in ('super_admin', 'admin')),
  created_at timestamptz default now()
);

-- ============================================
-- REAL-TIME ENABLEMENT
-- ============================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table access_codes;

-- ============================================
-- ROW LEVEL SECURITY (basic - expand later)
-- ============================================
alter table clients enable row level security;
alter table users enable row level security;
alter table access_codes enable row level security;
alter table messages enable row level security;
alter table conversations enable row level security;
alter table audit_log enable row level security;

-- Allow all for now (lock down per role in production)
create policy "allow all" on clients for all using (true);
create policy "allow all" on users for all using (true);
create policy "allow all" on access_codes for all using (true);
create policy "allow all" on messages for all using (true);
create policy "allow all" on conversations for all using (true);
create policy "allow all" on audit_log for all using (true);

-- ============================================
-- INDEXES for performance
-- ============================================
create index on messages(conversation_id, created_at);
create index on access_codes(code, is_active);
create index on access_codes(client_id, is_active);
create index on conversations(client_id, user_id);
create index on audit_log(client_id, created_at);
