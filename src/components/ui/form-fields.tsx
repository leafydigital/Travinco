import { cn } from '@/lib/utils/cn';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type FieldWrapperProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
};

export function FieldWrapper({ label, error, hint, required, children }: FieldWrapperProps) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  required,
  className,
  ...props
}: FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <input
        className={cn('input', error && 'border-red-400 focus:border-red-500 focus:ring-red-500', className)}
        {...props}
      />
    </FieldWrapper>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  className,
  ...props
}: FieldWrapperProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <textarea
        className={cn('input', error && 'border-red-400 focus:border-red-500 focus:ring-red-500', className)}
        {...props}
      />
    </FieldWrapper>
  );
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  children,
  ...props
}: FieldWrapperProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <select
        className={cn('input', error && 'border-red-400 focus:border-red-500 focus:ring-red-500', className)}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}
