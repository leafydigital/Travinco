'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export interface PackageStat {
  name: string;
  enquiries: number;
  bookings: number;
  revenue: number;
}

// Categorical slots 1 & 2 of the validated chart palette (blue, orange)
const SERIES = [
  { key: 'enquiries', label: 'Enquiries', color: '#2a78d6' },
  { key: 'bookings', label: 'Bookings', color: '#eb6834' },
] as const;

/** Package name under its columns: up to two short lines, cut with … */
function wrapName(name: string, perLine = 13): string[] {
  const words = name.split(/\s+/);
  const lines: string[] = [''];
  for (const w of words) {
    const last = lines[lines.length - 1]!;
    if ((last + ' ' + w).trim().length <= perLine) lines[lines.length - 1] = (last + ' ' + w).trim();
    else if (lines.length < 2) lines.push(w);
    else {
      lines[1] = `${lines[1]}…`;
      break;
    }
  }
  return lines.map((l) => (l.length > perLine + 1 ? `${l.slice(0, perLine)}…` : l));
}

function PackageTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const lines = wrapName(payload?.value ?? '');
  return (
    <g transform={`translate(${x ?? 0},${(y ?? 0) + 6})`}>
      <text textAnchor="middle" fill="#334155" fontSize={11}>
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 8 : 13}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: PackageStat }[] }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 max-w-[240px] font-semibold text-ink-900">{row.name}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-2 text-ink-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
          {s.label}: <span className="font-semibold text-ink-900">{row[s.key]}</span>
        </p>
      ))}
      {row.revenue > 0 && <p className="mt-1 text-ink-500">Booking value: {formatCurrency(row.revenue)}</p>}
    </div>
  );
}

/**
 * Vertical column chart of the month's top packages: a pair of columns per
 * package (enquiries, bookings), with month totals above.
 */
export function TopPackagesChart({ data, monthName }: { data: PackageStat[]; monthName: string }) {
  const totals = data.reduce(
    (t, d) => ({ enquiries: t.enquiries + d.enquiries, bookings: t.bookings + d.bookings, revenue: t.revenue + d.revenue }),
    { enquiries: 0, bookings: 0, revenue: 0 }
  );

  return (
    <section className="card overflow-hidden" aria-labelledby="top-packages-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div>
          <h2 id="top-packages-heading" className="text-sm font-semibold text-ink-900">
            Top selling packages
          </h2>
          <p className="text-xs text-ink-500">Ranked by bookings, then enquiries · {monthName}</p>
        </div>
        <ul className="flex items-center gap-4 text-xs text-ink-600" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
          <Package className="h-8 w-8 text-ink-300" />
          <p className="text-sm text-ink-500">No package enquiries or bookings in {monthName}.</p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 divide-x divide-ink-100 border-b border-ink-100 bg-ink-50/40">
            <div className="px-5 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Enquiries</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{totals.enquiries}</dd>
            </div>
            <div className="px-5 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Bookings</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{totals.bookings}</dd>
            </div>
            <div className="px-5 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Booking value</dt>
              <dd className="mt-0.5 truncate text-lg font-semibold tabular-nums text-ink-900">
                {totals.revenue > 0 ? formatCurrency(totals.revenue) : '—'}
              </dd>
            </div>
          </dl>

          {/* Scrolls sideways on narrow screens instead of squashing the columns */}
          <div className="overflow-x-auto">
            <div className="h-[340px] px-2 pb-2 pt-5 sm:px-4" style={{ minWidth: Math.max(320, data.length * 96) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 16, right: 8, bottom: 8, left: -8 }} barGap={3} barCategoryGap="26%">
                  <CartesianGrid vertical={false} stroke="#eef1f4" />
                  <XAxis dataKey="name" interval={0} height={44} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={<PackageTick />} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
                  {SERIES.map((s) => (
                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={30}>
                      <LabelList dataKey={s.key} position="top" fontSize={11} fill="#334155" formatter={(v: number) => (v > 0 ? v : '')} />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
