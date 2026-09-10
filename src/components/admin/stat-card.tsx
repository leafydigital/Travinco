import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const toneClasses: Record<string, string> = {
    default: 'bg-brand-50 text-brand-700',
    warning: 'bg-sand-100 text-sand-700',
    danger: 'bg-red-50 text-red-600',
    success: 'bg-brand-50 text-brand-700',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        <span className={cn('rounded-full p-2', toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}
