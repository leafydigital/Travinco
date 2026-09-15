/**
 * Local demo/seed data script.
 *
 * Run with: npm run seed
 *
 * Refuses to run unless ALLOW_DEMO_SEED=true is set in .env.local, so it
 * can never accidentally populate a production database. Uses the
 * service-role client to bypass RLS for bulk inserts — this script is
 * meant for local/dev use only, never invoked from the running app.
 *
 * All records are tagged with "[DEMO]" in their title/name where visible,
 * so they can be found and removed later with a single query, e.g.:
 *   delete from travel_packages where title like '[DEMO]%';
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// tsx/node scripts don't get Next.js's automatic .env.local loading, so
// it has to be loaded explicitly here. Resolved relative to this file so
// it works regardless of which directory you run the script from.
config({ path: resolve(__dirname, '../../.env.local') });

import { createClient } from '@supabase/supabase-js';


if (process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error(
    'Refusing to seed: set ALLOW_DEMO_SEED=true in .env.local to allow this script to run. ' +
      'This is a deliberate safeguard against ever running it against production.'
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Seeding demo data...\n');

  const destinationsData = [
    { name: '[DEMO] Kerala', slug: 'demo-kerala', country: 'India', description: 'Backwaters, hill stations and beaches.', status: 'published' as const, is_featured: true },
    { name: '[DEMO] Himachal Pradesh', slug: 'demo-himachal-pradesh', country: 'India', description: 'Mountains, valleys and hill towns.', status: 'published' as const, is_featured: true },
    { name: '[DEMO] Goa', slug: 'demo-goa', country: 'India', description: 'Beaches, nightlife and Portuguese heritage.', status: 'published' as const, is_featured: true },
    { name: '[DEMO] Rajasthan', slug: 'demo-rajasthan', country: 'India', description: 'Forts, palaces and desert landscapes.', status: 'published' as const, is_featured: false },
  ];

  const { data: destinations, error: destError } = await supabase
    .from('destinations')
    .insert(destinationsData)
    .select('id, slug, name');

  if (destError) throw destError;
  console.log(`Created ${destinations.length} destinations`);

  const kerala = destinations.find((d) => d.slug === 'demo-kerala')!;
  const himachal = destinations.find((d) => d.slug === 'demo-himachal-pradesh')!;
  const goa = destinations.find((d) => d.slug === 'demo-goa')!;
  const rajasthan = destinations.find((d) => d.slug === 'demo-rajasthan')!;

  const packagesData = [
    {
      destination_id: kerala.id,
      title: '[DEMO] Kerala Backwaters & Munnar',
      slug: 'demo-kerala-backwaters-munnar',
      category: 'family' as const,
      status: 'published' as const,
      is_featured: true,
      duration_days: 6,
      duration_nights: 5,
      base_price: 24999,
      discount_price: 21999,
      short_description: 'Houseboat stays, tea gardens and hill station views.',
      full_description:
        'A relaxed six-day route through Kochi, Munnar and Alleppey covering colonial history, tea estate hikes, and an overnight houseboat cruise through the backwaters.',
      highlights: ['Private houseboat overnight stay', 'Tea plantation walk in Munnar', 'Fort Kochi heritage walk'],
      total_seats: 20,
      seats_booked: 6,
    },
    {
      destination_id: himachal.id,
      title: '[DEMO] Manali & Kasol Adventure',
      slug: 'demo-manali-kasol-adventure',
      category: 'adventure' as const,
      status: 'published' as const,
      is_featured: true,
      duration_days: 5,
      duration_nights: 4,
      base_price: 18999,
      discount_price: null,
      short_description: 'River rafting, valley treks and riverside campsites.',
      full_description:
        'Covers Manali and Kasol with white-water rafting on the Beas, a day trek toward Kheerganga, and two nights of riverside camping.',
      highlights: ['White-water rafting', 'Kheerganga trek', 'Riverside camping'],
      total_seats: 15,
      seats_booked: 9,
    },
    {
      destination_id: goa.id,
      title: '[DEMO] Goa Beach Retreat',
      slug: 'demo-goa-beach-retreat',
      category: 'honeymoon' as const,
      status: 'published' as const,
      is_featured: true,
      duration_days: 4,
      duration_nights: 3,
      base_price: 15999,
      discount_price: 13499,
      short_description: 'North Goa beaches with a sunset cruise.',
      full_description:
        'Beachfront stay in North Goa with a private sunset cruise, guided old-Goa heritage tour, and free time at Baga and Anjuna.',
      highlights: ['Beachfront resort stay', 'Private sunset cruise', 'Old Goa heritage tour'],
      total_seats: 30,
      seats_booked: 4,
    },
    {
      destination_id: rajasthan.id,
      title: '[DEMO] Jaipur & Udaipur Heritage Trail',
      slug: 'demo-jaipur-udaipur-heritage',
      category: 'luxury' as const,
      status: 'draft' as const,
      is_featured: false,
      duration_days: 7,
      duration_nights: 6,
      base_price: 42999,
      discount_price: null,
      short_description: "Forts, palaces and a lake-city finale in Udaipur.",
      full_description:
        "A heritage-focused route through Jaipur's forts and Udaipur's lakes, staying in heritage properties throughout.",
      highlights: ['Amber Fort elephant/jeep ride', 'City Palace Udaipur', 'Lake Pichola boat ride'],
      total_seats: 12,
      seats_booked: 0,
    },
  ];

  const { data: packages, error: pkgError } = await supabase
    .from('travel_packages')
    .insert(packagesData)
    .select('id, slug, title');

  if (pkgError) throw pkgError;
  console.log(`Created ${packages.length} packages`);

  const keralaPkg = packages.find((p) => p.slug === 'demo-kerala-backwaters-munnar')!;

  await supabase.from('package_itineraries').insert([
    { package_id: keralaPkg.id, day_number: 1, title: 'Arrival in Kochi', description: 'Airport pickup and Fort Kochi heritage walk in the evening.', meals: 'Dinner' },
    { package_id: keralaPkg.id, day_number: 2, title: 'Drive to Munnar', description: 'Scenic drive through spice plantations, check in near tea estates.', meals: 'Breakfast, Dinner' },
    { package_id: keralaPkg.id, day_number: 3, title: 'Munnar sightseeing', description: 'Tea museum, Mattupetty dam, Eravikulam National Park.', meals: 'Breakfast, Dinner' },
    { package_id: keralaPkg.id, day_number: 4, title: 'Drive to Alleppey, houseboat check-in', description: 'Afternoon check-in to a private houseboat for an overnight backwater cruise.', meals: 'Breakfast, Lunch, Dinner' },
    { package_id: keralaPkg.id, day_number: 5, title: 'Alleppey to Kochi', description: 'Disembark, free time in Kochi for shopping.', meals: 'Breakfast' },
    { package_id: keralaPkg.id, day_number: 6, title: 'Departure', description: 'Airport drop.', meals: 'Breakfast' },
  ]);

  await supabase.from('package_inclusions').insert([
    { package_id: keralaPkg.id, item: 'Airport pickup and drop' },
    { package_id: keralaPkg.id, item: 'All accommodation on double sharing' },
    { package_id: keralaPkg.id, item: 'Houseboat with all meals' },
    { package_id: keralaPkg.id, item: 'Private AC vehicle for all transfers' },
  ]);

  await supabase.from('package_exclusions').insert([
    { package_id: keralaPkg.id, item: 'Airfare / train fare to Kochi' },
    { package_id: keralaPkg.id, item: 'Personal expenses and tips' },
    { package_id: keralaPkg.id, item: 'Entry tickets not mentioned in itinerary' },
  ]);

  console.log('Added itinerary/inclusions/exclusions for the Kerala package');

  const customersData = [
    { full_name: '[DEMO] Ritika Sharma', phone: '+919810000001', email: 'ritika.demo@example.com', city: 'Delhi', source: 'website' as const, whatsapp_opt_in: true, whatsapp_number: '+919810000001' },
    { full_name: '[DEMO] Arjun Nair', phone: '+919810000002', email: 'arjun.demo@example.com', city: 'Bengaluru', source: 'referral' as const, whatsapp_opt_in: true, whatsapp_number: '+919810000002' },
    { full_name: '[DEMO] Devika Menon', phone: '+919810000003', email: 'devika.demo@example.com', city: 'Kochi', source: 'whatsapp' as const, whatsapp_opt_in: false },
  ];

  const { data: customers, error: custError } = await supabase
    .from('customers')
    .insert(customersData)
    .select('id, full_name, phone');

  if (custError) throw custError;
  console.log(`Created ${customers.length} customers`);

  const goaPkg = packages.find((p) => p.slug === 'demo-goa-beach-retreat')!;
  const manaliPkg = packages.find((p) => p.slug === 'demo-manali-kasol-adventure')!;

  const { data: enquiries, error: enqError } = await supabase
    .from('enquiries')
    .insert([
      {
                customer_id: customers[0]!.id,
        customer_name: customers[0]!.full_name,
        phone: customers[0]!.phone,
        email: 'ritika.demo@example.com',
        package_id: goaPkg.id,
        destination: 'Goa',
        travel_date: '2026-11-15',
        number_of_adults: 2,
        source: 'website' as const,
        status: 'new' as const,
        priority: 'high' as const,
        message: 'Looking for a honeymoon package in November, budget around 30k for two.',
      },
      {
        customer_id: customers[1]!.id,
        customer_name: customers[1]!.full_name,
        phone: customers[1]!.phone,
        email: 'arjun.demo@example.com',
        package_id: manaliPkg.id,
        destination: 'Manali',
        travel_date: '2026-10-05',
        number_of_adults: 4,
        source: 'referral' as const,
        status: 'follow_up' as const,
        priority: 'medium' as const,
        next_followup_date: new Date().toISOString().slice(0, 10),
        message: 'Group of 4 friends, interested in the adventure package.',
      },
    ])
    .select('id');

  if (enqError) throw enqError;
  console.log(`Created ${enquiries.length} enquiries`);

  const { data: booking, error: bookError } = await supabase
    .from('bookings')
    .insert({
      customer_id: customers[1]!.id,
      package_id: manaliPkg.id,
      travel_start_date: '2026-10-05',
      travel_end_date: '2026-10-09',
      number_of_adults: 4,
      base_amount: 75996,
      discount_amount: 2000,
      booking_status: 'partially_paid' as const,
    })
    .select('id')
    .single();

  if (bookError) throw bookError;

  await supabase.from('booking_passengers').insert([
    { booking_id: booking.id, full_name: 'Arjun Nair', age: 29, passenger_type: 'adult' as const },
    { booking_id: booking.id, full_name: 'Kavya Rao', age: 27, passenger_type: 'adult' as const },
  ]);

  const { error: payError } = await supabase.from('payments').insert({
    booking_id: booking.id,
    amount: 30000,
    payment_method: 'upi' as const,
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: 'DEMO-UPI-0001',
    notes: '[DEMO] Advance payment',
  });
  if (payError) throw payError;

  console.log('Created 1 booking with passengers and a payment');

  // This script bypasses the recordPayment() server action (which
  // normally creates the matching income row automatically), so it's
  // seeded directly here to keep the demo data internally consistent.
  await supabase.from('income').insert({
    income_date: new Date().toISOString().slice(0, 10),
    category: 'package_booking',
    description: '[DEMO] Advance payment — Manali booking',
    customer_id: customers[1]!.id,
    booking_id: booking.id,
    amount: 30000,
    payment_method: 'upi',
    reference_number: 'DEMO-UPI-0001',
  });

  const { data: categories, error: catError } = await supabase
    .from('expense_categories')
    .insert([
      { name: 'Hotel', sort_order: 1 },
      { name: 'Transport', sort_order: 2 },
      { name: 'Flight', sort_order: 3 },
      { name: 'Staff', sort_order: 4 },
      { name: 'Office', sort_order: 5 },
      { name: 'Marketing', sort_order: 6 },
      { name: 'Food', sort_order: 7 },
      { name: 'Visa', sort_order: 8 },
      { name: 'Supplier', sort_order: 9 },
      { name: 'Commission', sort_order: 10 },
      { name: 'Software', sort_order: 11 },
      { name: 'Other', sort_order: 12 },
    ])
    .select('id, name');

  if (catError) throw catError;
  console.log(`Created ${categories.length} expense categories`);

  await supabase.from('expenses').insert({
    expense_date: new Date().toISOString().slice(0, 10),
    category_id: categories.find((c) => c.name === 'Hotel')!.id,
    supplier: '[DEMO] Hillview Resorts',
    description: '[DEMO] Advance for Manali hotel block booking',
    booking_id: booking.id,
    package_id: manaliPkg.id,
    amount: 18000,
    payment_method: 'bank_transfer' as const,
  });

  const { data: events, error: eventError } = await supabase
    .from('events')
    .insert([
      {
        title: '[DEMO] Travel Fair 2026',
        slug: 'demo-travel-fair-2026',
        description: 'Meet our team, get exclusive show-only discounts on select packages.',
        location: 'Phoenix Marketcity, Bengaluru',
        event_date: '2026-11-20',
        status: 'published' as const,
        cta_label: 'Register interest',
      },
    ])
    .select('id');
  if (eventError) throw eventError;
  console.log(`Created ${events.length} event`);

  const { error: offerError } = await supabase.from('offers').insert({
    title: '[DEMO] Early Bird Goa Special',
    slug: 'demo-early-bird-goa-special',
    description: 'Book 30 days in advance and save on the Goa Beach Retreat package.',
    package_id: goaPkg.id,
    discount_percent: 15,
    valid_from: new Date().toISOString().slice(0, 10),
    valid_to: '2026-12-31',
    status: 'published' as const,
    terms: 'Valid on new bookings only. Cannot be combined with other offers.',
  });
  if (offerError) throw offerError;
  console.log('Created 1 offer');

  console.log('\nDemo data seeded successfully.');
  console.log('To remove it later, delete any row whose name/title starts with "[DEMO]".');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
