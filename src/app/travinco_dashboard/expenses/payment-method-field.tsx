'use client';

import { useState } from 'react';
import { PAYMENT_METHOD_OPTIONS, isStandardPaymentMethod } from '@/lib/payment-methods';

const CUSTOM = '__custom__';

/** Payment method dropdown with a "Custom…" option that reveals a free-text input. */
export function PaymentMethodField({
  value,
  onChange,
  className = '',
}: {
  /** A standard method value, or the custom label typed by the user. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [customMode, setCustomMode] = useState(() => !isStandardPaymentMethod(value));

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={customMode ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustomMode(true);
            onChange('');
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
        className={`input ${customMode ? 'w-36 shrink-0' : ''}`}
      >
        {PAYMENT_METHOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {customMode && (
        <input
          type="text"
          autoFocus
          maxLength={50}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter payment method"
          className="input min-w-0 flex-1"
        />
      )}
    </div>
  );
}
