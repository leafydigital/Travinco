'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Loader2, Mail, MessageCircle, Pencil, Phone, Save, X } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { enquirySourceLabel, splitEnquiryMessage } from '@/lib/enquiry-display';
import { addYearsIso, todayIso } from '@/lib/utils/iso-date';
import { PhoneInput, COUNTRY_PHONE_CODES } from '@/components/public/phone-input';
import { AdminDateField, blockNonNumericKeys, parseNonNegative } from '@/components/admin/package-fields';
import { updateEnquiryDetails } from '../actions';
import { EnquiryStatusSelector } from '../enquiry-status-selector';
import { EnquiryControls } from './enquiry-controls';
import type { Tables } from '@/types/database';

function splitPhone(stored?: string | null): { dialCode: string; number: string } {
  if (!stored) return { dialCode: '+91', number: '' };
  const sorted = [...COUNTRY_PHONE_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (stored.startsWith(c.code)) return { dialCode: c.code, number: stored.slice(c.code.length) };
  }
  return { dialCode: '+91', number: stored.replace(/\D/g, '') };
}

type Values = {
  customer_name: string;
  whatsapp_number: string;
  destination: string;
  travel_date: string;
  return_date: string;
  number_of_adults: number | '';
  number_of_children: number | '';
  number_of_infants: number | '';
  budget: number | '';
  message: string;
};

function initialValues(enquiry: Tables<'enquiries'>): Values {
  return {
    customer_name: enquiry.customer_name,
    whatsapp_number: enquiry.whatsapp_number ?? '',
    destination: enquiry.destination ?? '',
    travel_date: enquiry.travel_date ?? '',
    return_date: enquiry.return_date ?? '',
    number_of_adults: enquiry.number_of_adults,
    number_of_children: enquiry.number_of_children,
    number_of_infants: enquiry.number_of_infants,
    budget: enquiry.budget ?? '',
    message: splitEnquiryMessage(enquiry.message).body,
  };
}

/** Label + value cell; the column span keeps short values (counts, dates) narrow. */
function Field({
  label,
  span = 'col-span-1',
  required,
  children,
}: {
  label: string;
  span?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0', span)}>
      <p className="mb-1 text-xs font-medium text-ink-400">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </p>
      <div className="text-sm text-ink-800">{children}</div>
    </div>
  );
}

export function EnquiryDetailCard({
  enquiry,
  packageTitle,
  staff,
  canEdit,
  initialEditing,
  children,
}: {
  enquiry: Tables<'enquiries'>;
  packageTitle: string | null;
  staff: { id: string; full_name: string }[];
  canEdit: boolean;
  initialEditing: boolean;
  /** Rest of the page (notes, timeline) — inside this wrapper so the header stays sticky. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(initialEditing && canEdit);
  const [baseline, setBaseline] = useState<Values>(() => initialValues(enquiry));
  const [values, setValues] = useState<Values>(baseline);
  const initiallySame = !enquiry.whatsapp_number || enquiry.whatsapp_number === enquiry.phone;
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(initiallySame);
  const [whatsappValue, setWhatsappValue] = useState(() => splitPhone(enquiry.whatsapp_number || enquiry.phone));
  const [whatsappValid, setWhatsappValid] = useState(true);

  const { prefix: messagePrefix } = splitEnquiryMessage(enquiry.message);
  const sourceLabel = enquirySourceLabel(enquiry.source, enquiry.message);

  const isDirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(baseline), [values, baseline]);

  const today = todayIso();
  const maxTravelDate = addYearsIso(today, 1);
  const returnMin = values.travel_date || today;
  const maxReturnDate = addYearsIso(returnMin, 1);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function numberProps(key: 'number_of_adults' | 'number_of_children' | 'number_of_infants' | 'budget', integer = true) {
    return {
      type: 'number',
      min: key === 'number_of_adults' ? 1 : 0,
      step: integer ? 1 : 'any',
      inputMode: integer ? ('numeric' as const) : ('decimal' as const),
      value: values[key],
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => blockNonNumericKeys(e, !integer),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseNonNegative(e.target.value, integer);
        if (parsed !== null) set(key, parsed);
      },
      className: 'input',
    };
  }

  function handleTravelDateChange(iso: string) {
    setValues((v) => {
      const next = { ...v, travel_date: iso };
      if (iso && v.return_date && (v.return_date < iso || v.return_date > addYearsIso(iso, 1))) next.return_date = '';
      return next;
    });
  }

  function validate(): string | null {
    if (values.customer_name.trim().length < 2) return 'Please enter the customer name.';
    if (values.number_of_adults === '' || values.number_of_adults < 1) return 'Adults must be at least 1.';
    if (values.number_of_children !== '' && values.number_of_children < 0) return 'Children cannot be negative.';
    if (values.number_of_infants !== '' && values.number_of_infants < 0) return 'Infants cannot be negative.';
    if (!whatsappSameAsPhone && whatsappValue.number) {
      const waDigits = whatsappValue.number.replace(/\D/g, '');
      if (/^0+$/.test(waDigits)) return 'WhatsApp number cannot be all zeros.';
      if (!whatsappValid) return 'Please enter a valid WhatsApp number.';
    }
    if (values.travel_date && values.travel_date > maxTravelDate) return 'Travel date must be within 1 year from today.';
    if (values.travel_date && values.return_date) {
      if (values.return_date < values.travel_date) return 'Return date cannot be before the travel date.';
      if (values.return_date > addYearsIso(values.travel_date, 1)) return 'Return date must be within 1 year of the travel date.';
    }
    return null;
  }

  function cancelEdit() {
    setValues(baseline);
    setWhatsappSameAsPhone(initiallySame);
    setWhatsappValue(splitPhone(enquiry.whatsapp_number || enquiry.phone));
    setEditing(false);
  }

  function handleSave() {
    if (!isDirty) return;
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    const message = values.message.trim();
    startTransition(async () => {
      const result = await updateEnquiryDetails(enquiry.id, {
        ...values,
        number_of_children: values.number_of_children === '' ? 0 : values.number_of_children,
        number_of_infants: values.number_of_infants === '' ? 0 : values.number_of_infants,
        budget: values.budget === '' ? undefined : values.budget,
        // Keep the "[Contact form — subject]" marker so the source stays recognisable
        message: messagePrefix && message ? `${messagePrefix} ${message}` : message,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Enquiry details updated');
      setBaseline(values);
      setEditing(false);
      router.refresh();
    });
  }

  function guardUnsaved(): boolean {
    if (editing && isDirty) {
      toast.warning('You have unsaved changes', {
        description: 'Please save (or cancel) your changes before leaving this page.',
      });
      return false;
    }
    return true;
  }

  const phoneDisplay = enquiry.phone && enquiry.phone !== 'Not provided' ? enquiry.phone : null;

  return (
    <div className="space-y-6 pb-16">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 -mx-3.5 border-b border-ink-200 bg-ink-50/95 px-3.5 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-900">{enquiry.enquiry_number}</h1>
              <EnquiryStatusSelector enquiryId={enquiry.id} currentStatus={enquiry.status} canEdit={canEdit} />
            </div>
            <p className="truncate text-sm text-ink-500">{enquiry.customer_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <button type="button" onClick={cancelEdit} disabled={isPending} className="btn-outline inline-flex items-center gap-1.5">
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending || !isDirty}
                  title={!isDirty ? 'Change a field to enable saving' : undefined}
                  className="btn-primary inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isPending ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : (
              canEdit && (
                <button type="button" onClick={() => setEditing(true)} className="btn-outline inline-flex items-center gap-1.5">
                  <Pencil className="h-4 w-4" /> Edit details
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => {
                if (guardUnsaved()) router.push(`/travinco_dashboard/quotations/new?enquiry=${enquiry.id}`);
              }}
              onMouseEnter={() => router.prefetch(`/travinco_dashboard/quotations/new?enquiry=${enquiry.id}`)}
              className="btn-outline inline-flex items-center gap-1.5"
            >
              <FileText className="h-4 w-4" /> Create quotation
            </button>
            <Link
              href="/travinco_dashboard/enquiries"
              onClick={(e) => {
                if (!guardUnsaved()) e.preventDefault();
              }}
              className="btn-outline inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        </div>
      </div>

      {/* ── All enquiry details in one card ── */}
      <div className={cn('card space-y-5 p-5', editing && 'ring-1 ring-brand-200')}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-800">Enquiry details</h2>
          {editing && <span className="text-xs font-medium text-brand-700">Editing — save from the top bar</span>}
        </div>

        <EnquiryControls
          enquiryId={enquiry.id}
          currentStatus={enquiry.status}
          currentPriority={enquiry.priority}
          currentAssignee={enquiry.assigned_staff}
          currentFollowupDate={enquiry.next_followup_date}
          staff={staff}
          canEdit={canEdit}
        />

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-ink-100 pt-4 sm:grid-cols-4 lg:grid-cols-6">
          {/* Customer */}
          <Field label="Full name" span="col-span-2" required={editing}>
            {editing ? (
              <input value={values.customer_name} onChange={(e) => set('customer_name', e.target.value)} className="input" />
            ) : (
              values.customer_name
            )}
          </Field>
          <Field label="Phone" span="col-span-2 lg:col-span-1">
            {phoneDisplay ? (
              <a href={`tel:${phoneDisplay}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                <Phone className="h-3.5 w-3.5 text-ink-400" /> {phoneDisplay}
              </a>
            ) : (
              <span className="text-ink-400">Not provided</span>
            )}
          </Field>
          <Field label="Email" span="col-span-2 lg:col-span-2">
            {enquiry.email ? (
              <a href={`mailto:${enquiry.email}`} className="inline-flex min-w-0 items-center gap-1.5 break-all hover:text-brand-700">
                <Mail className="h-3.5 w-3.5 shrink-0 text-ink-400" /> {enquiry.email}
              </a>
            ) : (
              <span className="text-ink-400">—</span>
            )}
          </Field>
          <Field label="Source">{sourceLabel}</Field>

          <Field label="WhatsApp" span={editing ? 'col-span-2 sm:col-span-4 lg:col-span-3' : 'col-span-2 lg:col-span-1'}>
            {editing ? (
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    checked={whatsappSameAsPhone}
                    onChange={(e) => {
                      setWhatsappSameAsPhone(e.target.checked);
                      set(
                        'whatsapp_number',
                        e.target.checked
                          ? initiallySame
                            ? baseline.whatsapp_number
                            : enquiry.phone
                          : `${whatsappValue.dialCode}${whatsappValue.number}`
                      );
                    }}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  Same as phone number
                </label>
                {!whatsappSameAsPhone && (
                  <PhoneInput
                    name="whatsapp_number"
                    value={whatsappValue}
                    onValidityChange={setWhatsappValid}
                    onChange={(next) => {
                      setWhatsappValue(next);
                      set('whatsapp_number', `${next.dialCode}${next.number}`);
                    }}
                  />
                )}
              </div>
            ) : enquiry.whatsapp_number ? (
              <a
                href={`https://wa.me/${enquiry.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-brand-700"
              >
                <MessageCircle className="h-3.5 w-3.5 text-ink-400" /> {enquiry.whatsapp_number}
              </a>
            ) : (
              <span className="text-ink-400">Same as phone</span>
            )}
          </Field>

          {/* Trip */}
          <Field label="Package" span="col-span-2">
            {packageTitle ?? <span className="text-ink-400">—</span>}
          </Field>
          <Field label="Destination" span="col-span-2 lg:col-span-1">
            {editing ? (
              <input value={values.destination} onChange={(e) => set('destination', e.target.value)} className="input" />
            ) : (
              values.destination || <span className="text-ink-400">—</span>
            )}
          </Field>
          <Field label="Travel date">
            {editing ? (
              <AdminDateField value={values.travel_date} onChange={handleTravelDateChange} min={today} max={maxTravelDate} />
            ) : (
              formatDate(values.travel_date || null)
            )}
          </Field>
          <Field label="Return date">
            {editing ? (
              <AdminDateField
                value={values.return_date}
                onChange={(iso) => set('return_date', iso)}
                min={returnMin}
                max={maxReturnDate}
              />
            ) : (
              formatDate(values.return_date || null)
            )}
          </Field>
          <Field label="Adults" required={editing}>
            {editing ? <input {...numberProps('number_of_adults')} /> : values.number_of_adults}
          </Field>
          <Field label="Children">
            {editing ? <input {...numberProps('number_of_children')} /> : values.number_of_children || 0}
          </Field>
          <Field label="Infants">
            {editing ? <input {...numberProps('number_of_infants')} /> : values.number_of_infants || 0}
          </Field>
          <Field label="Budget (per person)">
            {editing ? (
              <input {...numberProps('budget', false)} />
            ) : values.budget !== '' && values.budget ? (
              formatCurrency(values.budget)
            ) : (
              <span className="text-ink-400">—</span>
            )}
          </Field>

          {/* Message — shown once */}
          <Field label="Message" span="col-span-2 sm:col-span-4 lg:col-span-6">
            {editing ? (
              <textarea rows={3} value={values.message} onChange={(e) => set('message', e.target.value)} className="input" />
            ) : values.message ? (
              <p className="whitespace-pre-wrap rounded-lg bg-sand-50/70 p-3 text-ink-700">{values.message}</p>
            ) : (
              <span className="text-ink-400">—</span>
            )}
          </Field>
        </div>
      </div>

      {children}
    </div>
  );
}
