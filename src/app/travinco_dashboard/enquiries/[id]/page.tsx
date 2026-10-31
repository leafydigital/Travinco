import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { formatDateTime } from '@/lib/utils/format';
import { NotesPanel } from './notes-followups';
import { EnquiryDetailCard } from './enquiry-detail-card';
import { canAccess } from '@/lib/tour/access';
import { maskBadWords } from '@/lib/validations/contact-rules';

export default async function EnquiryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { edit?: string };
}) {
  const profile = await requireProfile();
  await assertModulePermission(profile, 'enquiries', 'view');
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const canEdit = isAdmin || (await checkModulePermission(profile, 'enquiries', 'edit')).allowed;
  const isEditing = searchParams?.edit === 'true' && canEdit;
  const supabase = await createClient();

  const [{ data: enquiry }, { data: staff }, { data: activities }] =
    await Promise.all([
      supabase
        .from('enquiries')
        .select('*, travel_packages(title, slug, base_price, discount_price)')
        .eq('id', params.id)
        .single(),
      supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase
        .from('enquiry_activities')
        .select('*, profiles(full_name)')
        .eq('enquiry_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

  if (!enquiry || enquiry.is_deleted) notFound();
  // Employees only work on the enquiries assigned to them
  if (!isAdmin && enquiry.assigned_staff !== profile.id) notFound();

  // Quotation/invoice already raised for this enquiry, so the invoice button can point at it
  let invoiceAccess: {
    quotation: { id: string; quote_number: string } | null;
    invoice: { id: string; invoice_number: string } | null;
  } | null = null;
  if (canAccess(profile, 'invoices')) {
    const [{ data: quote }, { data: direct }] = await Promise.all([
      supabase
        .from('quotations')
        .select('id, quote_number, status')
        .eq('enquiry_id', enquiry.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('invoices').select('id, invoice_number').eq('enquiry_id', enquiry.id).neq('status', 'cancelled').limit(1).maybeSingle(),
    ]);
    let invoice = direct ?? null;
    if (!invoice && quote?.status === 'invoiced') {
      const { data: viaQuote } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('quotation_id', quote.id)
        .neq('status', 'cancelled')
        .limit(1)
        .maybeSingle();
      invoice = viaQuote ?? null;
    }
    invoiceAccess = { quotation: quote ? { id: quote.id, quote_number: quote.quote_number } : null, invoice };
  }

  const pkgRaw = enquiry.travel_packages as
    | { title: string; slug: string; base_price: number | null; discount_price: number | null }
    | { title: string; slug: string; base_price: number | null; discount_price: number | null }[]
    | null;
  const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] ?? null : pkgRaw;
  return (
    <EnquiryDetailCard
      // Customer text is stored as typed; staff only ever receive the masked version
      enquiry={{ ...enquiry, message: maskBadWords(enquiry.message) }}
      packageTitle={pkg?.title ?? null}
      staff={staff ?? []}
      canEdit={canEdit}
      canAssign={isAdmin}
      initialEditing={isEditing}
      invoiceAccess={invoiceAccess}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <NotesPanel enquiryId={enquiry.id} notes={enquiry.notes} />

        <div className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold text-ink-800">Activity timeline</h2>
          <ul className="space-y-3">
            {(activities ?? []).length === 0 && <p className="text-sm text-ink-400">No activity yet.</p>}
            {(activities ?? []).map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <p className="text-ink-700">{a.description}</p>
                  <p className="text-xs text-ink-400">
                    {formatDateTime(a.created_at)}
                    {(() => {
                      const prof = a.profiles as { full_name: string } | { full_name: string }[] | null;
                      const name = Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name;
                      return name && ` · ${name}`;
                    })()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </EnquiryDetailCard>
  );
}
