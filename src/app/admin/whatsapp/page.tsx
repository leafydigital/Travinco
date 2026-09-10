import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/supabase/auth-helpers';
import Link from 'next/link';
import { formatDate } from '@/lib/utils/format';
import { ContactAddForm } from './contact-add-form';
import { ContactRowActions } from './contact-row-actions';

export default async function WhatsappContactsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: contacts }, { data: customers }] = await Promise.all([
    supabase.from('whatsapp_contacts').select('*').order('created_at', { ascending: false }),
    supabase.from('customers').select('id, full_name').order('full_name').limit(200),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">WhatsApp contacts</h1>
          <p className="text-sm text-ink-500">{(contacts ?? []).length} contacts</p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/admin/whatsapp" className="btn-outline bg-brand-50 border-brand-300 text-brand-700">
            Contacts
          </Link>
          <Link href="/admin/whatsapp/templates" className="btn-outline">
            Templates
          </Link>
          <Link href="/admin/whatsapp/campaigns" className="btn-outline">
            Campaigns
          </Link>
        </nav>
      </div>

      <ContactAddForm customers={customers ?? []} />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Tags</th>
                <th className="px-5 py-3">Opt-in</th>
                <th className="px-5 py-3">Since</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {(contacts ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-400">
                    No WhatsApp contacts yet.
                  </td>
                </tr>
              )}
              {(contacts ?? []).map((c) => (
                <tr key={c.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-5 py-3 text-ink-700">{c.display_name ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-600">{c.phone}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t} className="badge bg-ink-100 text-ink-600">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${c.opt_in ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-500'}`}>
                      {c.opt_in ? 'Opted in' : 'Opted out'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-500">
                    {c.opt_in ? formatDate(c.opted_in_at) : formatDate(c.opted_out_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ContactRowActions id={c.id} optIn={c.opt_in} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
