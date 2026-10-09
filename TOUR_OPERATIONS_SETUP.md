# Tour Operations – setup & file guide

New admin menu section **Tour operations**: Quotations, Invoices, Hotels, Transportation,
Pickup & Drop Points, Locations & Activities. The stand-alone Itinerary Builder
(HTML demo) is now the **Quotations** module, running on the Supabase Rate Master.

## 1. Database (Supabase SQL Editor, in this order)

| Step | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/029_tour_operations.sql` | New tables, hotel contact columns, location columns, RLS, `v_quote_rates` view, invoice payment trigger |
| 2 | `supabase/seed/029_tour_operations_seed.sql` | Master data from the Itinerary Builder: 12 itinerary locations + sightseeing (93), 30 distances, 8 pickup/drop points, 58 day plans, 11 package templates, exclusions / cancellation / notes |

Both are safe to run again. Run the seed **after** the Rate Master has been imported if you
want the package templates to pick up their hotel category (otherwise set it once in
Quotations › Settings). Requires migrations 001–028 (already in the project).

## 2. First-time setup in the app (admin)

1. **Quotations › Settings** – check markup (15%), GST (5%), rounding, company GSTIN,
   address and bank details (printed on invoices). Click **Rebuild date windows** once.
2. **Transportation** – add each transport company and car type: amount (per day or per trip),
   free km, extra ₹/km, driver bata.
3. **Pickup & Drop Points** – check the km-to-town values (seeded values are estimates).
4. **Hotels** – fill in phone / email / contact person (the list has a "Phone missing" filter).
5. **Locations & Activities** – distances, sightseeing descriptions and day plans can be edited any time.

## 3. Who can do what

| Area | Sales staff | Accounts staff | Admin / Super admin |
|---|---|---|---|
| Quotations | create, edit, send | create, edit, send | all + change markup, delete |
| Invoices | convert, edit, record payments | all + cancel, payments go to Income | all |
| Hotels, Transport, Points, Locations | view | – | view + edit |

## 4. How a quotation is priced

* **Hotels** – each night is priced from the Rate Master row whose season dates cover that night
  (highest season wins). "Auto" picks the cheapest room in the chosen category; houseboats are
  priced per boat sized to the group. Extra adults (beyond 2 per room) and child with/without bed
  are added from the same row. If no row covers the date, the season is guessed and a warning shows.
* **Vehicle** – amount × days (or per trip) + (total km − free km) × extra ₹/km + driver bata +
  tolls/parking. Total km = pickup/drop km + distances between stays + local running per night;
  staff can type the real km instead.
* **Total** = (hotels + vehicle + other costs) + markup, + GST on that, rounded to ₹100.
* The server re-prices on save, so the stored totals never depend on the browser.

**Convert to Invoice** creates a GST tax invoice for exactly the quoted total (taxable value
worked back from the total; CGST+SGST in Kerala, IGST otherwise), links/creates the customer,
marks the quotation *invoiced* and the enquiry *confirmed*. Payments update the balance by
trigger and are also booked in **Income** when recorded by accounts/admin.

## 5. Changed existing files

* `src/lib/admin-nav.ts`, `src/components/admin/admin-sidebar.tsx` – new menu section + icons
* `src/app/admin/layout.tsx` – sidebar hidden when printing (PDF)
* `src/app/admin/enquiries/[id]/page.tsx` – "Create quotation" button
* `src/lib/excel/date-range-parser.ts` – now uses `season-dates.ts`. The old parser treated any
  label it could not read (e.g. "Oct 2026 – Jan 2027", "Mar & Jun – Sep 2026", "Diwali 05 – 15 Nov 2026")
  as valid for the whole year, which priced those hotels from the wrong season. 35 of the 136
  date labels in the 2026-27 Rate Master were affected.

## 6. New files

```
supabase/migrations/029_tour_operations.sql
supabase/seed/029_tour_operations_seed.sql
public/brand/travinco-logo.png
src/lib/excel/season-dates.ts            season date parser
src/lib/tour/types.ts | engine.ts        quotation engine (pricing + itinerary), pure TS
src/lib/tour/data.ts                     Supabase loaders
src/lib/tour/access.ts | wa.ts           roles, WhatsApp links
src/lib/tour/master-actions.ts           server actions for master data + settings
src/components/admin/entity-manager.tsx  reusable table + form dialog
src/components/tour/*                    builder, quotation & invoice documents, badges
src/app/admin/quotations/**              list, new, view, edit, settings
src/app/admin/invoices/**                list, view/edit, payments
src/app/admin/hotels/**                  list, detail (contacts, rates, follow-ups), new
src/app/admin/transport/page.tsx
src/app/admin/pickup-points/page.tsx
src/app/admin/locations/**               locations, activities, distances, day plans
```
