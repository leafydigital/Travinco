import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import { EnquiryControls } from './enquiry-controls';
import { NotesPanel, FollowupsPanel } from './notes-followups';
import { ConvertToBookingButton } from './convert-button';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default async function EnquiryDetailPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: enquiry }, { data: staff }, { data: followups }, { data: activities }] =
    await Promise.all([
      supabase
        .from('enquiries')
        .select('*, travel_packages(title, slug)')
        .eq('id', params.id)
        .single(),
      supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase
        .from('enquiry_followups')
        .select('*')
        .eq('enquiry_id', params.id)
        .order('followup_date', { ascending: false }),
      supabase
        .from('enquiry_activities')
        .select('*, profiles(full_name)')
        .eq('enquiry_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

  if (!enquiry) notFound();

  const pkg = enquiry.travel_packages as { title: string; slug: string } | null;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink-900">{enquiry.enquiry_number}</h1>
            <StatusBadge status={enquiry.status} />
          </div>
          <p className="text-sm text-ink-500">{enquiry.customer_name}</p>
        </div>
        <div className="flex gap-2">
          <ConvertToBookingButton enquiryId={enquiry.id} hasPackage={Boolean(enquiry.package_id)} />
          <Link href="/admin/enquiries" className="btn-outline">
            Back to enquiries
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold text-ink-800">Enquiry details</h2>
            <EnquiryControls
              enquiryId={enquiry.id}
              currentStatus={enquiry.status}
              currentPriority={enquiry.priority}
              currentAssignee={enquiry.assigned_staff}
              staff={staff ?? []}
            />

            <dl className="grid grid-cols-2 gap-4 border-t border-ink-100 pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-400">Package</dt>
                <dd className="text-ink-700">{pkg?.title ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Destination</dt>
                <dd className="text-ink-700">{enquiry.destination ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Travel date</dt>
                <dd className="text-ink-700">{formatDate(enquiry.travel_date)}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Adults / Children</dt>
                <dd className="text-ink-700">
                  {enquiry.number_of_adults} / {enquiry.number_of_children}
                </dd>
              </div>
              <div>
                <dt className="text-ink-400">Budget</dt>
                <dd className="text-ink-700">
                  {enquiry.budget ? formatCurrency(enquiry.budget) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-400">Source</dt>
                <dd className="capitalize text-ink-700">{enquiry.source.replace('_', ' ')}</dd>
              </div>
            </dl>

            {enquiry.message && (
              <div className="border-t border-ink-100 pt-4">
                <dt className="mb-1 text-sm text-ink-400">Message</dt>
                <dd className="text-sm text-ink-700">{enquiry.message}</dd>
              </div>
            )}
          </div>

          <NotesPanel enquiryId={enquiry.id} notes={enquiry.notes} />

          <div className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold text-ink-800">Activity timeline</h2>
            <ul className="space-y-3">
              {(activities ?? []).length === 0 && (
                <p className="text-sm text-ink-400">No activity yet.</p>
              )}
              {(activities ?? []).map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <p className="text-ink-700">{a.description}</p>
                    <p className="text-xs text-ink-400">
                      {formatDateTime(a.created_at)}
                      {(a.profiles as { full_name: string } | null)?.full_name &&
                        ` · ${(a.profiles as { full_name: string }).full_name}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold text-ink-800">Contact</h2>
            <div className="space-y-2 text-sm">
              <a href={`tel:${enquiry.phone}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-700">
                <Phone className="h-4 w-4" /> {enquiry.phone}
              </a>
              {enquiry.whatsapp_number && (
                <a
                  href={`https://wa.me/${enquiry.whatsapp_number.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-ink-700 hover:text-brand-700"
                >
                  <MessageCircle className="h-4 w-4" /> {enquiry.whatsapp_number}
                </a>
              )}
              {enquiry.email && (
                <a href={`mailto:${enquiry.email}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-700">
                  <Mail className="h-4 w-4" /> {enquiry.email}
                </a>
              )}
            </div>
          </div>

          <FollowupsPanel enquiryId={enquiry.id} followups={followups ?? []} />
        </div>
      </div>
    </div>
  );
}
