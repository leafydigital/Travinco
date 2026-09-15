# Wayfarer Trails — Travel Agency Management System

A full-stack travel agency public website + admin CRM/booking/finance system.
Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL,
Auth, RLS).

Inspired by the general structure of travel-agency sites like travinco.com
(public packages, destinations, offers, contact/booking flow) but built as
an original implementation — no copied text, images, or branding.

---

## ⚠️ Read this first

This project was generated in a sandboxed environment with **no network
access** — `npm install`, `tsc`, and `next build` were never actually run
against this code. Every file was hand-written carefully against current
Next.js 14 / Supabase / Zod APIs, but you are the first real compiler this
code will meet. See **Known limitations** below before assuming everything
works out of the box.

---

## 1. Installation

```bash
cd travel-agency-system
npm install
cp .env.example .env.local
```

Fill in `.env.local` — see section 4 below for what each variable does.

## 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (or run
   `supabase start` locally if you use the Supabase CLI).
2. Copy your project URL, anon key, and service role key from
   **Settings → API** into `.env.local`.
3. Run the migrations in order. Easiest path — paste each file's contents
   into the Supabase SQL Editor, in this order:

   ```
   supabase/migrations/001_core.sql
   supabase/migrations/002_packages.sql
   supabase/migrations/003_enquiries.sql
   supabase/migrations/004_bookings.sql
   supabase/migrations/005_events_offers.sql
   supabase/migrations/006_whatsapp.sql
   supabase/migrations/007_finance.sql
   supabase/migrations/008_system.sql
   supabase/migrations/009_auth_trigger.sql
   supabase/migrations/010_rls.sql
   ```

   Or, if you have the Supabase CLI linked to your project:
   ```bash
   supabase db push
   ```

## 3. Database migration notes

- All tables use UUID primary keys, `created_at`/`updated_at` timestamps,
  and foreign keys with sensible `ON DELETE` behavior (`CASCADE` for
  child records like itinerary days, `RESTRICT` for things that shouldn't
  silently orphan like a package's destination, `SET NULL` for optional
  links like an enquiry's assigned staff).
- `bookings.total_amount` is a generated column; `balance_amount` and
  `payment_status` are kept correct by a trigger (`recalc_booking_balance`)
  whenever the money columns change — never hand-edit these in the DB.
- `payments` → `bookings.amount_received` sync is also trigger-driven
  (`sync_booking_amount_received`).
- WhatsApp opt-in is enforced by a trigger
  (`trg_campaign_recipient_requires_optin`) that blocks adding a
  non-opted-in contact as a campaign recipient — this happens at the
  database level regardless of what the app code does.
- RLS is enabled on every table (migration 010). Public/anonymous access
  is read-only on published content plus insert-only on `enquiries` and
  `contact_messages`. Everything else requires a `profiles` row (i.e.
  being logged in as staff), with finance tables further restricted to
  `accounts_staff` / `admin` / `super_admin`.

## 4. Environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Required? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server-only) | Bypasses RLS — used only in seed scripts and privileged server code. **Never** exposed to the browser. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Used for sitemap/canonical URLs |
| `RESEND_API_KEY`, `NOTIFICATION_EMAIL_*` | No | Enables admin email notifications on new enquiry/contact message. Leave blank to skip email (the DB write still happens either way). |
| `WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | No | Connects a real WhatsApp Business API provider. Leave `WHATSAPP_PROVIDER=mock` (default) to run campaigns without sending real messages. |
| `ALLOW_DEMO_SEED` | No | Must be `true` for `npm run seed` to run — a deliberate safeguard. |

## 5. Seed / demo data

```bash
# 1. Create your first login
npx tsx supabase/seed/create-admin.ts you@example.com yourpassword

# 2. Seed realistic demo data (destinations, packages, customers,
#    enquiries, a booking, income, expenses, an event, an offer)
npm run seed
```

All seeded rows are tagged `[DEMO]` in their visible name/title field so
they're easy to find and remove later:
```sql
delete from travel_packages where title like '[DEMO]%';
-- repeat for destinations, customers, events, offers, etc.
```

## 6. Admin account creation

Beyond the seed script above, additional staff accounts can be created by:
1. Having them sign up (if you build a self-serve flow — not included by
   default; the trigger in migration 009 will still create their
   `profiles` row automatically, defaulting to `sales_staff`), or
2. Creating them directly via Supabase Auth dashboard → Users → Add user,
   then updating their `profiles.role` in the table editor or via
   `/admin/users` (super_admin only) once you're logged in.

Roles: `super_admin`, `admin`, `sales_staff`, `accounts_staff`. See
`src/lib/admin-nav.ts` for exactly which nav items each role can see, and
`supabase/migrations/010_rls.sql` for what each role can actually read/write
at the database level.

## 7. Running locally

```bash
npm run dev
```

Visit `http://localhost:3000` for the public site, `http://localhost:3000/login`
for admin sign-in.

## 8. Testing

No automated test suite is included — this build prioritized breadth
(every module from the spec) over depth (test coverage) given the scope.
Recommended manual test path for your first run:

1. `/` → confirm hero and sections render (empty states are fine before seeding)
2. `/login` → sign in with your created admin account
3. `/admin/destinations` → create a destination, publish it
4. `/admin/packages` → create a package under that destination, add an
   itinerary day, an inclusion, publish it
5. Visit `/packages/<slug>` on the public site → confirm it renders, submit
   the enquiry form
6. `/admin/enquiries` → confirm the enquiry appears, convert it to a booking
7. `/admin/bookings/<id>` → record a payment, confirm balance/status update
8. `/admin/income` and `/admin/reports` → confirm the payment appears as income
9. `/admin/whatsapp` → add a contact, opt them in, create a template and
   campaign, send it (mock mode) → confirm recipient statuses update

## 9. Production deployment (not done — you asked to stay on localhost)

Deployment config is included for **Netlify** (`netlify.toml` +
`@netlify/plugin-nextjs` in `devDependencies`), which is the officially
supported way to run a Next.js App Router project — including Server
Actions (used throughout `/admin` and the public enquiry/contact forms) —
on Netlify without a custom adapter.

To deploy:
1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
   Netlify auto-detects `netlify.toml` and the Next.js plugin.
3. Under **Site settings → Environment variables**, add every variable
   from `.env.example` with real values — same as local, except
   `NEXT_PUBLIC_SITE_URL` should be your Netlify URL (or custom domain).
4. Deploy. First build runs `npm run build` per `netlify.toml`.
5. Keep `WHATSAPP_PROVIDER=mock` until you have real, approved WhatsApp
   Business API credentials — switching it is just an env var change,
   same as local.

Vercel remains an equally valid alternative (arguably the more common
choice for Next.js) if you'd rather use that — no code changes needed,
just skip `netlify.toml` and import the repo into Vercel instead.

---

## Files created

```
package.json, tsconfig.json, next.config.mjs, tailwind.config.ts,
postcss.config.mjs, .eslintrc.json, .env.example, .gitignore

src/middleware.ts
src/app/layout.tsx, globals.css, sitemap.ts, robots.ts

src/lib/supabase/{client,server,service,auth-helpers}.ts
src/lib/validations/{package,enquiry,booking,customer,finance,content,settings,whatsapp}.ts
src/lib/whatsapp/provider.ts
src/lib/email/notify.ts
src/lib/{utils/cn,utils/format,admin-nav,settings,testimonials-data}.ts
src/types/database.ts

src/components/ui/{status-badge,form-fields}.tsx
src/components/admin/{admin-sidebar,stat-card,string-list-editor}.tsx
src/components/public/{site-header,site-footer,package-card,enquiry-form,hero-search,section-heading}.tsx

src/app/(auth)/login/{page,login-form,actions}.tsx|ts
src/app/(public)/{layout,page,actions}.tsx|ts
src/app/(public)/packages/{page,[slug]/page}.tsx
src/app/(public)/destinations/{page,[slug]/page}.tsx
src/app/(public)/{offers,events,gallery,about,booking}/page.tsx
src/app/(public)/contact/{page,contact-form,actions}.tsx|ts

src/app/admin/{layout,page,actions}.tsx|ts
src/app/admin/packages/** (list, new, [id], actions, sub-resource-actions, form + managers)
src/app/admin/enquiries/** (list, [id], actions, controls, notes/followups, convert-button)
src/app/admin/bookings/** (list, [id], actions, payments/passengers panels, status control)
src/app/admin/customers/** (list, new, [id], actions, form)
src/app/admin/{income,expenses}/** (list, quick-add forms)
src/app/admin/reports/{page,reports-charts}.tsx
src/app/admin/{events,offers,gallery}/** (list, new, [id], row-actions, forms)
src/app/admin/destinations/** (list, new, [id], actions, form, row-actions)
src/app/admin/whatsapp/** (contacts, templates, campaigns — full CRUD + send flow)
src/app/admin/settings/** (general/booking forms, expense categories, actions)
src/app/admin/{content-actions,finance-actions,delete-finance-row-button}.ts|tsx

supabase/migrations/001–010_*.sql  (26 tables, enums, triggers, RLS)
supabase/seed/{run-seed,create-admin}.ts

README.md (this file)
```

## Files modified

None — this was a greenfield build with no existing project to modify.

## Database changes

26 tables across 10 migrations. Full schema in `supabase/migrations/`.
Summary: `profiles`, `customers`, `destinations`, `travel_packages` (+
`package_images`, `package_itineraries`, `package_inclusions`,
`package_exclusions`), `gallery`, `enquiries` (+ `enquiry_followups`,
`enquiry_activities`), `bookings` (+ `booking_passengers`, `payments`),
`events`, `offers`, `whatsapp_contacts`, `whatsapp_templates`,
`whatsapp_campaigns`, `whatsapp_campaign_recipients`, `income`,
`expense_categories`, `expenses`, `contact_messages`, `notifications`,
`website_settings`, `audit_logs`.

## Environment variables required

See section 4 above and `.env.example`.

## Commands to run

```bash
npm install
cp .env.example .env.local   # then fill in values
npx tsx supabase/seed/create-admin.ts you@example.com yourpassword
npm run seed                 # optional demo data, needs ALLOW_DEMO_SEED=true
npm run dev
npm run type-check            # tsc --noEmit
npm run lint
npm run build                 # production build check
```

## Test accounts

None created automatically — run `create-admin.ts` (section 6) to create
your first login. No hardcoded credentials exist anywhere in the codebase.

## Known limitations

Being direct about what's unverified or intentionally deferred:

- **Never compiled.** This entire codebase was written without access to
  `npm`, `tsc`, or a live Supabase connection. Expect to fix some import
  paths, type mismatches, or Next.js 14 API details on first
  `npm install && npm run dev`. Report exact error messages back and they
  can be fixed quickly — that's a much faster loop than me guessing blind.
- **Image uploads are URL-based, not file-upload.** Package images,
  gallery, destination covers, event/offer images all take a pasted
  image URL rather than a real upload-to-Supabase-Storage flow. Wiring
  actual file upload (Storage bucket + signed upload + `next/image`
  `remotePatterns` already configured for `*.supabase.co`) is the
  natural next step.
- **Testimonials are static**, not database-driven — no `testimonials`
  table exists in the agreed schema. See `src/lib/testimonials-data.ts`
  for how to add one if wanted.
- **WhatsApp real-provider path is a reference implementation**
  (`MetaCloudApiProvider`) that has never made a real API call — the
  request shape follows Meta's documented Cloud API format but should be
  smoke-tested against a real sandbox number before production use.
- **No automated tests.** Manual test path given in section 8.
- **Rate limiting is in-memory**, which resets on server restart and
  doesn't share state across multiple server instances — fine for a
  single-instance local/small deployment, not for serverless-at-scale.
- **Booking number / enquiry number / income number / expense number
  prefixes are hardcoded in the SQL** (`BK-`, `ENQ-`, `INC-`, `EXP-`) —
  the Settings page's "booking prefix" field is currently cosmetic/
  stored-for-reference only, as noted in-app.

## Next steps

1. `npm install && npm run dev`, fix whatever surfaces
2. Wire real Supabase Storage upload for images
3. Add a `testimonials` table if you want those admin-editable
4. Get WhatsApp Business API approval from Meta (or another approved BSP)
   and smoke-test `MetaCloudApiProvider` against it
5. Add automated tests for the money-handling paths in particular
   (booking totals, payment sync) since those are the highest-stakes
   calculations in the system
6. Consider a background job queue for WhatsApp campaign sends once
   recipient lists grow beyond what one request/response cycle should handle
