-- =========================================================
-- MIGRATION 003: Enquiry CRM
-- =========================================================

create sequence public.enquiry_number_seq start 1;

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_number varchar(30) not null unique
    default ('ENQ-' || to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('public.enquiry_number_seq')::text, 5, '0')),

  customer_id uuid references public.customers (id) on delete set null,

  customer_name varchar(120) not null,
  phone varchar(20) not null,
  whatsapp_number varchar(20),
  email varchar(150),

  package_id uuid references public.travel_packages (id) on delete set null,
  destination varchar(120),

  travel_date date,
  return_date date,
  number_of_adults int not null default 1 check (number_of_adults >= 1),
  number_of_children int not null default 0 check (number_of_children >= 0),
  number_of_infants int not null default 0 check (number_of_infants >= 0),
  budget numeric(10, 2) check (budget >= 0),

  message text,
  source enquiry_source not null default 'website',

  assigned_staff uuid references public.profiles (id) on delete set null,
  status enquiry_status not null default 'new',
  priority enquiry_priority not null default 'medium',

  last_contacted_at timestamptz,
  next_followup_date date,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_return_after_travel check (return_date is null or travel_date is null or return_date >= travel_date)
);

comment on table public.enquiries is
  'Every public enquiry/booking-request form submission lands here first. Email notification is additive, never the source of truth.';

create index idx_enquiries_status on public.enquiries (status);
create index idx_enquiries_assigned_status on public.enquiries (assigned_staff, status);
create index idx_enquiries_followup_date on public.enquiries (next_followup_date) where status = 'follow_up';
create index idx_enquiries_phone on public.enquiries (phone);
create index idx_enquiries_customer on public.enquiries (customer_id);
create index idx_enquiries_created_at on public.enquiries (created_at desc);

create trigger trg_enquiries_updated_at before update on public.enquiries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------
-- ENQUIRY FOLLOWUPS  — scheduled, actionable follow-up tasks
-- ---------------------------------------------------------

create table public.enquiry_followups (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  followup_date date not null,
  followup_time time,
  followup_type followup_type not null default 'call',
  note text,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.enquiry_followups is
  'One row per scheduled follow-up task. Powers "Follow-ups due today" / "Overdue" dashboard widgets.';

create index idx_followups_enquiry on public.enquiry_followups (enquiry_id);
create index idx_followups_due on public.enquiry_followups (followup_date) where is_completed = false;

-- ---------------------------------------------------------
-- ENQUIRY ACTIVITIES  — append-only audit timeline
-- ---------------------------------------------------------

create table public.enquiry_activities (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  activity_type varchar(50) not null,
    -- e.g. 'status_changed', 'note_added', 'assigned', 'called',
    -- 'whatsapp_sent', 'email_sent', 'converted_to_booking'
  description text not null,
  metadata jsonb not null default '{}',
    -- e.g. {"from_status": "new", "to_status": "contacted"}
  performed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.enquiry_activities is
  'Append-only timeline of everything that happened on an enquiry. Never updated or deleted — insert only.';

create index idx_activities_enquiry on public.enquiry_activities (enquiry_id, created_at desc);
