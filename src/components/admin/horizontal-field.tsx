import { cn } from '@/lib/utils/cn';
import { COUNTRY_NAMES } from '@/lib/country-names';

/**
 * Horizontal form row: label on the left, control on the right (stacks on mobile).
 * `fieldClassName` sizes the control area so short inputs (phone, dates, amounts)
 * don't stretch across the whole form.
 */
export function HField({
  label,
  required,
  hint,
  error,
  htmlFor,
  labelWidth = 'sm:w-32',
  fieldClassName,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  labelWidth?: string;
  fieldClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3', className)}>
      <label
        htmlFor={htmlFor}
        className={cn('shrink-0 text-sm font-medium text-ink-700 sm:pt-2', labelWidth)}
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className={cn('min-w-0 flex-1', fieldClassName)}>
        {children}
        {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        {error && <p className="field-error">{error}</p>}
      </div>
    </div>
  );
}

const COUNTRY_OPTIONS = Array.from(new Set(Object.values(COUNTRY_NAMES))).sort((a, b) =>
  a.localeCompare(b)
);

/** Free-text country input with a dropdown of every country (native datalist). */
export function CountryInput({
  id,
  value,
  onChange,
  className,
  placeholder = 'Select or type a country',
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const listId = `${id}-countries`;
  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className={cn('input', className)}
      />
      <datalist id={listId}>
        {COUNTRY_OPTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
