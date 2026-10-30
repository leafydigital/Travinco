'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Circle, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/lib/admin-alert';
import { HField, CountryInput } from '@/components/admin/horizontal-field';
import { StringListEditor } from '@/components/admin/string-list-editor';
import { PhoneInput } from '@/components/public/phone-input';
import { cn } from '@/lib/utils/cn';
import { splitPhone, joinPhone } from '@/lib/utils/phone-parts';
import { validateFullName, validateEmailAddress } from '@/lib/validations/contact-rules';
import { PASSWORD_RULES, passwordMeetsRules } from '@/lib/temp-password';
import type { CustomerFormValues } from '@/lib/validations/customer';
import { createCustomer, updateCustomer, checkCustomerAvailability } from './actions';

export function CustomerForm({
  customerId,
  initialValues,
}: {
  customerId?: string;
  initialValues?: Partial<CustomerFormValues>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phoneValue, setPhoneValue] = useState(() => splitPhone(initialValues?.phone));
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(
    !initialValues?.whatsapp_number || initialValues.whatsapp_number === initialValues.phone
  );
  const [whatsappValue, setWhatsappValue] = useState(() => splitPhone(initialValues?.whatsapp_number));
  const [values, setValues] = useState<Partial<CustomerFormValues>>({
    source: 'website',
    country: 'India',
    tags: [],
    whatsapp_opt_in: false,
    ...initialValues,
  });

  const isCreate = !customerId;
  const [phoneValid, setPhoneValid] = useState(false);
  const [whatsappValid, setWhatsappValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const setError = (field: string, message: string | null) => setErrors((x) => ({ ...x, [field]: message }));

  // "Already taken" checks shown under the field while typing (no popups)
  const [taken, setTaken] = useState<{ email: string | null; phone: string | null }>({ email: null, phone: null });
  const phoneFull = joinPhone(phoneValue);
  useEffect(() => {
    setTaken((t) => ({ ...t, phone: null }));
    if (!phoneFull || !phoneValid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await checkCustomerAvailability({ phone: phoneFull, excludeId: customerId }).catch(() => null);
      if (!cancelled && res) setTaken((t) => ({ ...t, phone: res.phone }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneFull, phoneValid, customerId]);

  const emailTrimmed = (values.email ?? '').trim();
  useEffect(() => {
    setTaken((t) => ({ ...t, email: null }));
    if (!emailTrimmed || validateEmailAddress(emailTrimmed)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await checkCustomerAvailability({
        email: emailTrimmed,
        excludeId: customerId,
        newLogin: !customerId,
      }).catch(() => null);
      if (!cancelled && res) setTaken((t) => ({ ...t, email: res.email }));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [emailTrimmed, customerId]);

  const phoneMessage = errors.phone ?? taken.phone;
  const emailMessage = errors.email ?? taken.email;

  function validate(): Record<string, string | null> {
    const email = (values.email ?? '').trim();
    return {
      full_name: validateFullName(values.full_name ?? ''),
      phone: !phoneValue.number ? 'Phone number is required' : phoneValid ? taken.phone : 'Please enter a valid phone number',
      whatsapp_number:
        whatsappSameAsPhone || !whatsappValue.number || whatsappValid ? null : 'Please enter a valid WhatsApp number',
      email: isCreate || email ? validateEmailAddress(email) ?? taken.email : null,
      password: !isCreate
        ? null
        : !password
          ? 'Password is required'
          : passwordMeetsRules(password)
            ? null
            : 'Password does not meet all the rules below',
      confirm_password: !isCreate
        ? null
        : !confirmPassword
          ? 'Please confirm the password'
          : confirmPassword === password
            ? null
            : 'Passwords do not match',
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    // Problems are shown under each field
    if (Object.values(next).some(Boolean)) return;

    const payload = {
      ...values,
      full_name: (values.full_name ?? '').trim(),
      email: (values.email ?? '').trim(),
      phone: joinPhone(phoneValue),
      whatsapp_number: whatsappSameAsPhone ? joinPhone(phoneValue) : joinPhone(whatsappValue) || null,
    };

    startTransition(async () => {
      const result = customerId
        ? await updateCustomer(customerId, payload)
        : await createCustomer({ ...payload, password });

      if (result.error) {
        // Field problems (e.g. email / phone already taken) are shown under the field
        if ('field' in result && result.field) return void setError(result.field, result.error);
        toast.error(result.error);
        return;
      }

      toast.success(customerId ? 'Customer updated' : 'Customer created');
      if (!customerId && 'id' in result && result.id) {
        router.push(`/travinco_dashboard/customers/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="card space-y-3.5 p-5">
        <HField label="Full name" required htmlFor="cust-name" fieldClassName="sm:max-w-[14rem]">
          <input
            id="cust-name"
            required
            maxLength={120}
            className={cn('input', errors.full_name && 'border-red-400 focus:border-red-500')}
            placeholder="Enter full name"
            value={values.full_name ?? ''}
            onChange={(e) => {
              set('full_name', e.target.value);
              if (errors.full_name) setError('full_name', validateFullName(e.target.value));
            }}
            onBlur={(e) => setError('full_name', validateFullName(e.target.value))}
          />
          {errors.full_name && <p className="field-error">{errors.full_name}</p>}
        </HField>

        <HField label="Phone" required fieldClassName="sm:max-w-md">
          <PhoneInput
            name="phone"
            required
            placeholder="Enter number"
            value={phoneValue}
            onValidityChange={setPhoneValid}
            onChange={(next) => {
              setPhoneValue(next);
              set('phone', `${next.dialCode}${next.number}`);
              if (errors.phone) setError('phone', null);
              if (whatsappSameAsPhone) {
                setWhatsappValue(next);
                set('whatsapp_number', `${next.dialCode}${next.number}`);
              }
            }}
          />
          {phoneMessage && <p className="field-error">{phoneMessage}</p>}
        </HField>

        <HField label="WhatsApp" fieldClassName="sm:max-w-md">
          <label className="flex items-center gap-2 pt-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={whatsappSameAsPhone}
              onChange={(e) => {
                setWhatsappSameAsPhone(e.target.checked);
                if (e.target.checked) {
                  setWhatsappValue(phoneValue);
                  set('whatsapp_number', `${phoneValue.dialCode}${phoneValue.number}`);
                }
              }}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Same number for WhatsApp
          </label>
          {!whatsappSameAsPhone && (
            <div className="mt-2">
              <PhoneInput
                name="whatsapp_number"
                placeholder="Enter number"
                value={whatsappValue}
                onValidityChange={setWhatsappValid}
                onChange={(next) => {
                  setWhatsappValue(next);
                  set('whatsapp_number', `${next.dialCode}${next.number}`);
                  if (errors.whatsapp_number) setError('whatsapp_number', null);
                }}
              />
              {errors.whatsapp_number && <p className="field-error">{errors.whatsapp_number}</p>}
            </div>
          )}
        </HField>

        <HField label="Email" required={isCreate} htmlFor="cust-email" fieldClassName="sm:max-w-sm">
          <input
            id="cust-email"
            type="email"
            className={cn('input', emailMessage && 'border-red-400 focus:border-red-500')}
            placeholder="Enter email"
            value={values.email ?? ''}
            onChange={(e) => {
              set('email', e.target.value.trim());
              if (errors.email) setError('email', null);
            }}
            onBlur={(e) => setError('email', e.target.value.trim() || isCreate ? validateEmailAddress(e.target.value) : null)}
          />
          {emailMessage ? (
            <p className="field-error">{emailMessage}</p>
          ) : (
            isCreate && <p className="mt-1 text-xs text-ink-400">The customer signs in to the website with this email.</p>
          )}
        </HField>

        {isCreate && (
          <>
            <HField label="Password" required htmlFor="cust-password" fieldClassName="sm:max-w-sm">
              <div className="relative">
                <input
                  id="cust-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  maxLength={72}
                  className={cn('input pr-10', errors.password && 'border-red-400 focus:border-red-500')}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value.replace(/\s/g, ''));
                    if (errors.password) setError('password', null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password}</p>}
              <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                {PASSWORD_RULES.map((r) => {
                  const ok = r.test(password);
                  return (
                    <li key={r.key} className={cn('flex items-center gap-1.5', ok ? 'text-emerald-700' : 'text-ink-400')}>
                      {ok ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                      {r.label}
                    </li>
                  );
                })}
              </ul>
            </HField>

            <HField label="Confirm password" required htmlFor="cust-confirm-password" fieldClassName="sm:max-w-sm">
              <input
                id="cust-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={72}
                className={cn('input', errors.confirm_password && 'border-red-400 focus:border-red-500')}
                placeholder="Re-enter the password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value.replace(/\s/g, ''));
                  if (errors.confirm_password) setError('confirm_password', null);
                }}
                onBlur={(e) =>
                  e.target.value && setError('confirm_password', e.target.value === password ? null : 'Passwords do not match')
                }
              />
              {errors.confirm_password && <p className="field-error">{errors.confirm_password}</p>}
            </HField>
          </>
        )}

        <div className="grid gap-3.5 lg:grid-cols-2">
          <HField label="City" htmlFor="cust-city" fieldClassName="sm:max-w-[14rem]">
            <input
              id="cust-city"
              className="input"
              value={values.city ?? ''}
              onChange={(e) => set('city', e.target.value)}
            />
          </HField>
          <HField label="State" htmlFor="cust-state" labelWidth="sm:w-32 lg:w-16" fieldClassName="sm:max-w-[14rem]">
            <input
              id="cust-state"
              className="input"
              value={values.state ?? ''}
              onChange={(e) => set('state', e.target.value)}
            />
          </HField>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-2">
          <HField label="Country" htmlFor="cust-country" fieldClassName="sm:max-w-[14rem]">
            <CountryInput
              id="cust-country"
              value={values.country ?? 'India'}
              onChange={(v) => set('country', v)}
            />
          </HField>
          <HField label="Source" htmlFor="cust-source" labelWidth="sm:w-32 lg:w-16" fieldClassName="sm:max-w-[14rem]">
            <select
              id="cust-source"
              className="input"
              value={values.source ?? 'website'}
              onChange={(e) => set('source', e.target.value as CustomerFormValues['source'])}
            >
              <option value="website">Website</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone</option>
              <option value="walk_in">Walk-in</option>
              <option value="referral">Referral</option>
              <option value="social_media">Social media</option>
              <option value="other">Other</option>
            </select>
          </HField>
        </div>

        <HField label="Address" htmlFor="cust-address">
          <textarea
            id="cust-address"
            rows={2}
            className="input"
            value={values.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
          />
        </HField>

        <HField label="Marketing">
          <label className="flex items-center gap-2 pt-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={values.whatsapp_opt_in ?? false}
              onChange={(e) => set('whatsapp_opt_in', e.target.checked)}
              className="rounded border-ink-300"
            />
            Customer has opted in to WhatsApp marketing messages
          </label>
        </HField>
      </div>

      <div className="card space-y-3.5 p-5">
        <HField label="Tags" fieldClassName="sm:max-w-md">
          <StringListEditor
            label=""
            items={values.tags ?? []}
            onChange={(tags) => set('tags', tags)}
            placeholder="e.g. repeat_customer"
          />
        </HField>
        <HField label="Notes" htmlFor="cust-notes">
          <textarea
            id="cust-notes"
            rows={3}
            className="input"
            value={values.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </HField>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Link
          href="/travinco_dashboard/customers"
          className="btn-outline inline-flex items-center gap-2 text-ink-700 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Link>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : customerId ? 'Save changes' : 'Create customer'}
        </button>
      </div>
    </form>
  );
}
