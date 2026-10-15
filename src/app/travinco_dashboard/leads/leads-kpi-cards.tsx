'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, PhoneCall, Heart, Users } from 'lucide-react';

interface KpiCounts {
  total: number;
  fresh: number;
  followUp: number;
  interested: number;
  enquired: number;
}

interface Props {
  counts: KpiCounts;
}

export function LeadsKpiCards({ counts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') ?? '';

  function handleFilter(statusValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1'); // Reset to page 1
    if (!statusValue || currentStatus === statusValue) {
      params.delete('status');
    } else {
      params.set('status', statusValue);
    }
    router.push(`?${params.toString()}`);
  }

  const cards = [
    {
      key: '',
      label: 'Total Leads',
      count: counts.total,
      icon: Users,
      color: 'text-ink-600',
      bg: 'bg-ink-50',
      borderActive: 'border-brand-500 ring-2 ring-brand-100',
    },
    {
      key: 'fresh_lead',
      label: 'Fresh Leads',
      count: counts.fresh,
      icon: Sparkles,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      borderActive: 'border-blue-500 ring-2 ring-blue-100',
    },
    {
      key: 'follow_up',
      label: 'Follow-up',
      count: counts.followUp,
      icon: PhoneCall,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      borderActive: 'border-amber-500 ring-2 ring-amber-100',
    },
    {
      key: 'interested',
      label: 'Interested',
      count: counts.interested,
      icon: Heart,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      borderActive: 'border-emerald-500 ring-2 ring-emerald-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const isActive = (c.key === '' && !currentStatus) || currentStatus === c.key;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => handleFilter(c.key)}
            className={`card flex flex-col justify-between p-4 text-left transition hover:shadow-md cursor-pointer ${
              isActive ? c.borderActive : 'border-ink-100 hover:border-ink-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-500">{c.label}</span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold tracking-tight text-ink-900">{c.count.toLocaleString()}</span>
              {isActive && currentStatus === c.key && c.key !== '' && (
                <span className="ml-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                  Filtered
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
