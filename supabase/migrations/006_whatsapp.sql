-- =========================================================
-- MIGRATION 006: WhatsApp marketing (provider-agnostic)
--
-- These tables model campaigns/recipients/opt-in state only. Sending is
-- done by src/lib/whatsapp/*, which is written against an abstract
-- provider interface — see that module for the "mock" vs real official
-- WhatsApp Business API provider split. No credentials or automation
-- logic lives in the database.
-- =========================================================

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete cascade,
  phone varchar(20) not null unique,
  display_name varchar(120),
  tags text[] not null default '{}',
  opt_in boolean not null default false,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_optin_dates check (
    (opt_in = true and opted_in_at is not null) or
    (opt_in = false)
  )
);

comment on table public.whatsapp_contacts is
  'opt_in must be true before this contact can be a campaign recipient — enforced in trg_campaign_recipient_requires_optin below, not just app logic.';

create index idx_whatsapp_contacts_customer on public.whatsapp_contacts (customer_id);
create index idx_whatsapp_contacts_optin on public.whatsapp_contacts (opt_in);

create trigger trg_whatsapp_contacts_updated_at before update on public.whatsapp_contacts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null unique,
  category varchar(50) not null default 'marketing',
    -- mirrors WhatsApp Business API template categories: marketing, utility, authentication
  body text not null,
    -- with {{1}}, {{2}}-style placeholders per the official template format
  provider_template_id varchar(200),
    -- the template's approved ID/name at the WhatsApp Business API provider,
    -- once submitted and approved there. Null while still local-only/draft.
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_whatsapp_templates_updated_at before update on public.whatsapp_templates
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------

create table public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  name varchar(200) not null,
  template_id uuid references public.whatsapp_templates (id) on delete restrict,
  message_override text,
    -- optional ad-hoc message body if not using a template variable-fill
  media_url text,
  audience_filter jsonb not null default '{}',
    -- e.g. {"destination": "Kerala", "tags": ["repeat_customer"]}
  scheduled_at timestamptz,
  status whatsapp_campaign_status not null default 'draft',
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whatsapp_campaigns_status on public.whatsapp_campaigns (status);
create index idx_whatsapp_campaigns_scheduled on public.whatsapp_campaigns (scheduled_at);

create trigger trg_whatsapp_campaigns_updated_at before update on public.whatsapp_campaigns
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------

create table public.whatsapp_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns (id) on delete cascade,
  contact_id uuid not null references public.whatsapp_contacts (id) on delete cascade,
  delivery_status whatsapp_recipient_status not null default 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  provider_message_id varchar(200),

  unique (campaign_id, contact_id)
);

create index idx_campaign_recipients_campaign on public.whatsapp_campaign_recipients (campaign_id);
create index idx_campaign_recipients_status on public.whatsapp_campaign_recipients (delivery_status);

-- A recipient row must never be created for a contact who hasn't opted in.
create or replace function public.enforce_whatsapp_optin()
returns trigger
language plpgsql
as $$
declare
  contact_opt_in boolean;
begin
  select opt_in into contact_opt_in
  from public.whatsapp_contacts
  where id = new.contact_id;

  if contact_opt_in is not true then
    raise exception 'Cannot add contact % to a campaign: no valid WhatsApp opt-in on record', new.contact_id;
  end if;

  return new;
end;
$$;

create trigger trg_campaign_recipient_requires_optin
  before insert on public.whatsapp_campaign_recipients
  for each row execute function public.enforce_whatsapp_optin();
