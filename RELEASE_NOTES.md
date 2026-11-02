# Travinco — Release Notes

2 Nov 2026

## Release overview

This release delivers the complete Travinco platform: a public travel website with customer accounts, and a staff dashboard that runs enquiries, quotations, invoices, finance, rate masters and site content. It moves the application from development into user acceptance testing.

| Item | Detail |
| --- | --- |
| Build | Commit `4aec9f6` on branch `development`, 2 Nov 2026 |
| Package version | 0.1.0 (release version number still to be assigned) |
| Customer side | 21 pages: public website plus customer account area |
| Admin side | 50 dashboard pages plus staff sign-in |
| Server endpoints | 6 API routes plus server actions for every form |
| Development history | 41 commits since the first commit |

**Highlights in this release**

- New stand-alone invoice creation form for staff, with the customer's saved profile address filled in automatically.
- Enquiries and Leads merged into one CRM module, with a downloadable Excel report.
- Site-wide SEO: Kerala-focused titles, descriptions, keywords, canonical links and social-share images.
- Mobile and tablet layouts fixed across the public site and the dashboard's tables and bulk-create forms.
- Stricter form validation and unsaved-changes guards on public and admin forms.
- WhatsApp chat button on every public page.

## Customer side

Visitors can browse packages and destinations, send an enquiry, and — once signed in — track their enquiries and download their tax invoices and quotations.

### Public website

| Page | Route | What customers can do |
| --- | --- | --- |
| Home | `/` | Hero slider, package search, featured packages, testimonials, animated stats |
| Packages | `/packages` | Search, filter by destination and category, sort by price or duration, paginate; offer discounts shown while the offer window is active |
| Package detail | `/packages/[slug]` | Itinerary tabs, image carousel and lightbox, pricing, "Send Enquiry" form |
| Destinations | `/destinations`, `/destinations/[slug]` | Browse destinations and the packages for each |
| Blog | `/blog`, `/blog/[slug]` | Read travel articles with search and pagination |
| Events | `/events` | Upcoming events |
| About | `/about` | Company story and FAQ accordion |
| Contact | `/contact` | Contact details, click-to-email and click-to-call links, contact form |
| Booking / enquiry | `/booking` | Trip enquiry form; signed-in customers get their details prefilled, guests verify by email OTP |

Across the site:

- Floating WhatsApp chat button on every public page.
- Header and calls to action available in English, Hindi and Malayalam.
- Header account menu links to My Bookings, Profile and Change Password.
- Pages are cached and refresh every 60 seconds; staff edits clear the cache straight away.
- `/offers` and `/gallery` are switched off in this release and return "page not found".

### Customer account

| Feature | Route | Detail |
| --- | --- | --- |
| Sign up | `/account/signup` | Email verified with a 6-digit OTP; duplicate email and phone checked as the user types |
| Sign in | `/account/login` | Password, then a 6-digit OTP as a second step |
| Forgot password | `/account/login` | Three steps: enter email, enter emailed code, set new password |
| Change password | `/account/change-password` | For signed-in customers |
| Profile | `/account/profile` | Name, mobile, address; profile-completeness meter; email cannot be changed |
| My Bookings | `/account/bookings` | Two lists: My Enquiries (with live status from Submitted to Booked or Closed) and My Invoices |
| Tax invoice | `/account/bookings/invoices/[id]` | View, print or download the invoice |
| Tour quotation | `/account/bookings/quotations/[id]` | View the quotation sent by staff |

The address a customer saves on their profile now appears on their enquiry for staff and prefills the "Bill to" address on new invoices.

## Admin side

Staff sign in at `/app` and work in `/travinco_dashboard`, where each person sees only the modules their role allows. The dashboard covers the full sales cycle: enquiry, quotation, invoice, payment and expense.

### Dashboard home

- Lead counts: Total Leads, Pending Quote, Follow Up, Converted.
- Income and expense for a selected month; income counts fully paid invoices.
- Top-selling packages chart.

### Modules

| Area | Module | Key features |
| --- | --- | --- |
| Sales | Enquiries | Accept, reject, assign or bulk-assign; status and priority; notes and follow-up scheduling; Excel import; date-range filter; Excel report download; archive-and-clear; convert to booking. Leads are merged in here (`/leads` redirects) |
| Sales | Customers | Create, edit, activate or deactivate, delete; status filter; customer detail page |
| Tour operations | Quotations | Quote builder priced from the rate master; duplicate, save as template, set status, convert to invoice; quotation settings and logos |
| Tour operations | Invoices | New stand-alone invoice form; CGST+SGST or IGST at 0–28%; customer GSTIN check for B2B; record and delete payments; cancel; print or download |
| Tour operations | Hotels, Transportation, Pickup & Drop Points | Master data used by the quote builder |
| Tour operations | Locations & Activities | Locations, activities, distances and day plans, each with bulk create |
| Finance | Expenses | Quick add, edit, delete; payment method |
| Finance | Rate Master | Upload rates from Excel or a template; filter, edit, delete, clear all |
| Content | Packages | Create, edit, duplicate, publish or unpublish, feature; bulk create and a bulk editor; preview page |
| Content | Destinations, Blog | Create, edit, delete, bulk create |
| Content | Theme | Editors for Home, Packages, Destinations, Blog, About, Contact, navbar and footer, and page titles |
| Admin | Settings | Company details, GSTIN, state, bank details, SAC code, GST %, markup %, rounding, invoice due days and terms, quote validity days |
| Admin | Plugins | Add, edit, enable or disable code-embed plugins |
| Admin | Roles, Users | Custom roles with page-level access; staff accounts with temporary passwords, activate or deactivate, delete |
| Personal | Profile | Staff member's own profile |

### Roles and access

| Role | Default access |
| --- | --- |
| Super admin | Every module |
| Admin | Every module, including Settings, Plugins, Roles and Users |
| Sales staff | Every module except Expenses, Settings, Plugins, Roles and Users |
| Accounts staff | Dashboard, Customers, Quotations, Invoices, Expenses and Rate Master |
| Custom role | Only the pages granted in Role Management → Page access |

Permanent deletes first copy the rows to a Google Sheets archive, then remove all related records in one step or none at all.

## Improvements and bug fixes

Testing started on 23 Oct 2026; the 20 commits since then changed 408 files. The main changes, newest first:

| Date | Side | Change |
| --- | --- | --- |
| 2 Nov | Customer | Site-wide SEO: Kerala and Trivandrum focused titles, descriptions, keywords, canonical URLs, robots rules, Open Graph and Twitter share image |
| 2 Nov | Customer | Floating WhatsApp chat button added to all public pages |
| 2 Nov | Customer | Contact page simplified |
| 2 Nov | Admin | Package save, bulk package editor and package validation fixed |
| 2 Nov | Admin | Dashboard sections and top-packages chart corrected |
| 2 Nov | Admin | A customer who opens the dashboard now sees the normal staff sign-in instead of an error redirect |
| 1 Nov | Admin | Customer's saved profile address shown on the enquiry and prefilled as the invoice "Bill to" address |
| 1 Nov | Admin | Mobile layout fixed for bulk-create forms (blog, destinations, locations, activities, distances), users table, rate master, transport and profile |
| 31 Oct | Customer | Tablet layout fixed for the home page hero slider |
| 31 Oct | Both | Button labels renamed on the booking form, enquiry form and invoice actions |
| 31 Oct | Customer | New date picker using DD/MM/YYYY |
| 31 Oct | Customer | Click-to-email and click-to-call links on the contact page and footer |
| 31 Oct | Customer | Stronger validation on sign-up, enquiry and booking forms |
| 31 Oct | Both | Warning before leaving a form with unsaved changes |
| 31 Oct | Admin | Enquiry Excel report download; better notes and follow-ups |
| 31 Oct | Admin | New stand-alone invoice creation form with GST and GSTIN validation |
| 31 Oct | Admin | Shared filter bar on list pages; bulk package editor rebuilt |
| 31 Oct | Admin | Theme editors show field-level error messages |
| 30 Oct | Admin | Leads merged into Enquiries, with Excel import, date-range filter and clear-and-archive |
| 30 Oct | Admin | Permanent delete with a Google Sheets archive; restore for deactivated customers |
| 30 Oct | Admin | Dashboard month picker for income and expense |
| 30 Oct | Both | Staff and customer sign-in fixes; staff profile page; settings save bar and quotation logos |
| 30 Oct | Customer | My Bookings page fixed; print and download toolbar on invoices and quotations |
| 28–29 Oct | Admin | Google Sheets integration; dashboard and customer pages made faster |
| 23–27 Oct | Both | Package preview and tour package fixes; bugs reported by the Travinco team fixed |

## Technical notes and known issues

The build passes its automated checks, but security items from the 30 Oct pre-production audit are still open in this commit. Fix the critical ones before production.

### Stack and checks

| Item | Detail |
| --- | --- |
| Framework | Next.js 14.2.15 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Supabase: Postgres, Auth, Storage, row-level security |
| Email | Gmail via Nodemailer for OTP codes and security alerts |
| Integrations | Google Sheets archive, Excel import and export, QR codes, Recharts |
| Hosting config | Both `vercel.json` (Seoul region) and `netlify.toml` are present |
| Type-check (2 Nov) | Passed, 0 errors |
| Lint (2 Nov) | Passed, 0 errors, 3 warnings (login page hooks, date-picker accessibility) |
| Tests (2 Nov) | 12 of 12 passed; they cover only customer/staff session isolation |

### Deployment checklist

1. Set every variable listed in `.env.example` in the hosting environment, including a dedicated OTP secret.
2. Run the SQL files in `supabase/` on the production database. They are not tracked in git, so copy them from the developer's machine.
3. Place the Google service-account key on the server for the Sheets archive.
4. Choose one host, Vercel or Netlify, and remove the other's config.

### Known issues

| Severity | Issue | Status in this build |
| --- | --- | --- |
| Critical | Next.js 14.2.15 has published security advisories, including a middleware bypass that puts the staff-context header at risk | Open: still on 14.2.15 |
| Critical | Database functions that change passwords or delete records may be callable by anyone | Not verifiable: database functions are not in the repo |
| High | OTP encryption key falls back to a hard-coded value when the env variable is missing (`src/lib/auth/otp-crypto.ts`) | Open |
| High | Customer invoice lookup matches email with unescaped wildcards (`src/lib/services/customer-account.ts`) | Partly fixed: 1 of 5 lookups escaped |
| High | Recording two payments at once can save a wrong "amount paid" | Open: payment add still updates the stored total |
| Medium | No HTTP security headers | Open |
| Medium | Package title not escaped in the page's structured data | Open |
| Medium | Database schema and access rules are not in git | Open |
| Low | Events pages exist in the dashboard but are not in the sidebar | Open |
| Low | `/offers` and `/gallery` return "page not found" | Intended for this release |
| Low | Images are accepted from any HTTPS site | Open |

Full details are in `AUDIT_REPORT.md` in the repository.

### Open question

- What version number should this release carry? The package file still says 0.1.0.
