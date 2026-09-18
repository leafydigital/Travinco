-- Short-lived one-time codes for verifying a visitor actually controls
-- the email address they typed into the public enquiry form, before
-- the enquiry is accepted — deters spam/fake submissions with made-up
-- addresses. Codes expire quickly and are single-use; nothing here
-- touches customer_accounts or profiles, this is unauthenticated
-- anti-abuse, not a login.
create table public.enquiry_email_otps (
  id uuid primary key default gen_random_uuid(),
  email varchar(150) not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_enquiry_email_otps_email on public.enquiry_email_otps (email);

alter table public.enquiry_email_otps enable row level security;
-- No public policies at all: this table is only ever touched by server
-- actions using the service-role client, never read/written directly
-- from the browser.
