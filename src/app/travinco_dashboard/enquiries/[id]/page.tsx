import { createClient } from '@/lib/supabase/server';
import { requireProfile, assertModulePermission, checkModulePermission } from '@/lib/supabase/auth-helpers';
import { notFound } from 'next/navigation';
import { formatDateTime } from '@/lib/utils/format';
import { NotesPanel } from './notes-followups';
import { EnquiryDetailCard } from './enquiry-detail-card';

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

  const pkgRaw = enquiry.travel_packages as
    | { title: string; slug: string; base_price: number | null; discount_price: number | null }
    | { title: string; slug: string; base_price: number | null; discount_price: number | null }[]
    | null;
  const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] ?? null : pkgRaw;
  return (
    <EnquiryDetailCard
      enquiry={enquiry}
      packageTitle={pkg?.title ?? null}
      staff={staff ?? []}
      canEdit={canEdit}
      initialEditing={isEditing}
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
