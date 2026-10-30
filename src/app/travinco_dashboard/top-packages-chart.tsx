'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

export interface PackageStat {
  name: string;
  bookings: number;
  revenue: number;
}

// Categorical slot 1 of the validated chart palette
const BAR_COLOR = '#2a78d6';

/** Package name under its column: up to two short lines, cut with … */
function wrapName(name: string, perLine = 14): string[] {
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
      <p className="text-ink-600">
        Bookings: <span className="font-semibold text-ink-900">{row.bookings}</span>
      </p>
      {row.revenue > 0 && <p className="text-ink-500">Booking value: {formatCurrency(row.revenue)}</p>}
    </div>
  );
}

/** Vertical column chart of the month's top 5 packages by bookings. */
export function TopPackagesChart({ data, monthName }: { data: PackageStat[]; monthName: string }) {
  return (
    <section className="card overflow-hidden" aria-labelledby="top-packages-heading">
      <div className="border-b border-ink-100 px-5 py-4">
        <h2 id="top-packages-heading" className="text-sm font-semibold text-ink-900">
          Top selling packages
        </h2>
        <p className="text-xs text-ink-500">Top 5 by bookings · {monthName}</p>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
          <Package className="h-8 w-8 text-ink-300" />
          <p className="text-sm text-ink-500">No package bookings in {monthName}.</p>
        </div>
      ) : (
        // Scrolls sideways on narrow screens instead of squashing the columns
        <div className="overflow-x-auto">
          <div className="h-[320px] px-2 pb-2 pt-5 sm:px-4" style={{ minWidth: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 16, right: 8, bottom: 8, left: -8 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="#eef1f4" />
                <XAxis dataKey="name" interval={0} height={44} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={<PackageTick />} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
                <Bar dataKey="bookings" name="Bookings" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList dataKey="bookings" position="top" fontSize={12} fontWeight={600} fill="#334155" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
