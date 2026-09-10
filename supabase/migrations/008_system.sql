-- =========================================================
-- MIGRATION 008: Contact messages, notifications, settings, audit logs
-- =========================================================

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  phone varchar(20),
  whatsapp_number varchar(20),
  email varchar(150),
  subject varchar(200),
  message text not null,
  status contact_message_status not null default 'new',
  ip_address inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_contact_reachable check (phone is not null or email is not null)
);

comment on table public.contact_messages is
  'Public Contact Us submissions. ip_address is retained briefly for rate-limiting/spam review only — consider a scheduled job to null it out after 30 days.';

create index idx_contact_messages_status on public.contact_messages (status);
create index idx_contact_messages_created on public.contact_messages (created_at desc);

create trigger trg_contact_messages_updated_at before update on public.contact_messages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id) on delete cascade,
    -- null = broadcast to all admin/staff roles with dashboard access
  type notification_type not null,
  title varchar(200) not null,
  body text,
  link_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on public.notifications (recipient_id, is_read);
create index idx_notifications_created on public.notifications (created_at desc);

-- ---------------------------------------------------------

create table public.website_settings (
  id uuid primary key default gen_random_uuid(),
  key varchar(100) not null unique,
  value jsonb not null default '{}',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.website_settings is
  'Single-row-per-key config store, e.g. key=''general'' value={"business_name": "...", "phone": "..."}. Secrets like WhatsApp API tokens are NEVER stored here — those stay in server-only env vars. This table is for display/business settings only.';

create trigger trg_website_settings_updated_at before update on public.website_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action varchar(100) not null,
    -- e.g. 'package.published', 'booking.cancelled', 'user.role_changed'
  entity_type varchar(50) not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only. Written by server actions for sensitive admin operations (role changes, deletions, settings/credentials updates, booking cancellations) — never from the client.';

create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index idx_audit_logs_actor on public.audit_logs (actor_id);
create index idx_audit_logs_created on public.audit_logs (created_at desc);
