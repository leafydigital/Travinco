'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  blankInputs,
  buildCtx,
  buildSnapshot,
  computeDays,
  deriveMarkupPctFromTotal,
  durationLabel,
  fmtDay,
  hotelsIn,
  inr,
  inputsFromTemplate,
  isLocationInDestination,
  locName,
  newStay,
  num,
  quote,
  rateLocationIds,
  stayDates,
  totalNights,
  type DayLine,
  type DayOut,
  type EngineCtx,
  type QuoteCalc,
} from '@/lib/tour/engine';
import type { DayEdit, HotelPick, QuoteInputs, RateRow, StayInput, TourMasters } from '@/lib/tour/types';
import { getRatesForLocations, saveQuotation, searchCustomers } from '@/app/travinco_dashboard/quotations/actions';
import { QuoteDocument } from './quote-document';

const TRIP_TYPES = ['Tour', 'Honeymoon', 'Family', 'Group', 'Pilgrimage', 'Corporate', 'Adventure'];

const groupRates = (rows: RateRow[]) => {
  const out: Record<number, RateRow[]> = {};
  for (const r of rows) (out[r.location_id] ||= []).push(r);
  return out;
};

export function QuotationBuilder({
  masters: m,
  initial,
  initialRates,
  quoteId,
  quoteNumber,
  canOverrideMarkup,
}: {
  masters: TourMasters;
  initial: QuoteInputs;
  initialRates: RateRow[];
  quoteId: string | null;
  quoteNumber?: string;
  canOverrideMarkup: boolean;
}) {
  const router = useRouter();
  const [inputs, setInputs] = useState<QuoteInputs>(initial);
  const [rates, setRates] = useState<Record<number, RateRow[]>>(() => {
    const g = groupRates(initialRates);
    for (const id of rateLocationIds(m, initial.stays.map((s) => s.location_id))) g[id] ||= [];
    return g;
  });
  const [loading, setLoading] = useState(false);
  const [saving, startSave] = useTransition();
  const upd = (patch: Partial<QuoteInputs>) => setInputs((s) => ({ ...s, ...patch }));

  // Load Rate Master rows for any stay location we have not fetched yet.
  const stayKey = inputs.stays.map((s) => s.location_id).join(',');
  useEffect(() => {
    const need = rateLocationIds(m, inputs.stays.map((s) => s.location_id)).filter((id) => !(id in rates));
    if (!need.length) return;
    let alive = true;
    setLoading(true);
    getRatesForLocations(need)
      .then((rows) => {
        if (!alive) return;
        const g = groupRates(rows);
        setRates((prev) => {
          const next = { ...prev };
          for (const id of need) next[id] = g[id] ?? [];
          return next;
        });
      })
      .catch(() => toast.error('Could not load hotel rates.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stayKey]);

  const allRates = useMemo(() => Object.values(rates).flat(), [rates]);
  const ctx = useMemo(() => buildCtx(m, allRates, canOverrideMarkup), [m, allRates, canOverrideMarkup]);
  const q1 = useMemo(() => quote(ctx, inputs, 1), [ctx, inputs]);
  const q2 = useMemo(() => (inputs.category2_id ? quote(ctx, inputs, 2) : null), [ctx, inputs]);
  const days = useMemo(() => computeDays(ctx, inputs), [ctx, inputs]);
  const snapshot = useMemo(() => buildSnapshot(ctx, inputs, q1, q2), [ctx, inputs, q1, q2]);

  const save = (status?: 'draft' | 'sent') => {
    const warns = Array.from(new Set([...q1.warn, ...(q2?.warn ?? [])]));
    if (status === 'sent' && warns.length > 0) {
      toast.warning(warns[0] ?? 'Please verify quotation details before sending.', {
        description: warns.length > 1 ? `+${warns.length - 1} more items need attention` : undefined,
      });
    }
    startSave(async () => {
      const res = await saveQuotation(quoteId, inputs, status);
      if (res.error) return void toast.error(res.error);
      toast.success(quoteId ? 'Quotation saved' : 'Quotation created');
      router.push(`/admin/quotations/${res.id}`);
      router.refresh();
    });
  };

  const applyTemplate = (id: string) => {
    const t = m.templates.find((x) => String(x.id) === id);
    if (!t) return;
    setInputs((s) => inputsFromTemplate(m, s, t));
    setSelectedTemplateId(id);
  };

  // ---------------------------------------------------------------------------
  // 4-Dropdown Template Filtering System (Destination, Location, Days, Template)
  // ---------------------------------------------------------------------------
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    inputs.template_id ? String(inputs.template_id) : ''
  );

  // 1. Build list of destinations strictly from Destinations page (m.destinations)
  const destinationOptions = useMemo(() => {
    if (m.destinations && m.destinations.length > 0) {
      const map = new Map<string, string>();
      for (const d of m.destinations) {
        if (d?.name?.trim()) map.set(d.name.trim().toLowerCase(), d.name.trim());
      }
      return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }
    // Fallback only if no destinations exist in the system at all
    const map = new Map<string, string>();
    for (const l of m.locations) {
      if (l?.state?.trim()) map.set(l.state.trim().toLowerCase(), l.state.trim());
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [m.destinations, m.locations]);

  // 2. Enrich all templates with days, nights, locations, and associated destinations
  const enrichedTemplates = useMemo(() => {
    return (m.templates || []).map((t) => {
      const stays = t.stays || [];
      const nights = stays.reduce((sum, s) => sum + (Number(s.nights) || 0), 0);
      const days = nights > 0 ? nights + 1 : 1;
      const locationIds = stays.map((s) => Number(s.location_id));

      // Resolve destinations for this template
      const destSet = new Set<string>();
      for (const locId of locationIds) {
        const loc = m.locations.find((l) => l.id === locId);
        if (loc) {
          const state = loc.state?.trim();
          if (state) {
            const matched = destinationOptions.find(
              (d) =>
                d.toLowerCase() === state.toLowerCase() ||
                d.toLowerCase().includes(state.toLowerCase()) ||
                state.toLowerCase().includes(d.toLowerCase())
            );
            if (matched) destSet.add(matched);
            else destSet.add(state);
          }
          const locName = loc.name?.trim();
          if (locName) {
            const matched = destinationOptions.find(
              (d) => d.toLowerCase() === locName.toLowerCase()
            );
            if (matched) destSet.add(matched);
          }
        }
      }
      // Also match destination names appearing in template title
      for (const d of destinationOptions) {
        if (t.name.toLowerCase().includes(d.toLowerCase())) {
          destSet.add(d);
        }
      }

      return {
        ...t,
        idStr: String(t.id),
        totalNights: nights,
        totalDays: days,
        locationIds,
        destinations: Array.from(destSet),
      };
    });
  }, [m.templates, m.locations, destinationOptions]);

  // 3. Filtered locations strictly under the selected destination only
  const availableLocations = useMemo(() => {
    if (!selectedDestination) {
      return [];
    }
    return m.locations.filter((l) => {
      if (!l.is_active) return false;
      return isLocationInDestination(l, selectedDestination, m.locations);
    });
  }, [m.locations, selectedDestination]);

  // 4. Available number of days based on templates, destination and location
  const availableDays = useMemo(() => {
    let pool = enrichedTemplates;
    if (selectedDestination) {
      const destLower = selectedDestination.toLowerCase().trim();
      const destPool = pool.filter((t) =>
        t.destinations.some((d) => d.toLowerCase().trim() === destLower)
      );
      if (destPool.length > 0) pool = destPool;
    }
    if (selectedLocation) {
      const locPool = pool.filter((t) => t.locationIds.includes(Number(selectedLocation)));
      if (locPool.length > 0) pool = locPool;
    }

    const daysSet = new Set<number>();
    for (const t of pool) {
      if (t.totalDays) daysSet.add(t.totalDays);
    }
    // Also include days from all templates so user can always choose any template duration
    for (const t of enrichedTemplates) {
      if (t.totalDays) daysSet.add(t.totalDays);
    }
    return Array.from(daysSet).sort((a, b) => a - b);
  }, [enrichedTemplates, selectedDestination, selectedLocation]);

  // 5. Filtered templates list matching all active filter criteria
  const filteredTemplates = useMemo(() => {
    return enrichedTemplates.filter((t) => {
      if (selectedDestination) {
        const destLower = selectedDestination.toLowerCase().trim();
        if (!t.destinations.some((d) => d.toLowerCase().trim() === destLower)) {
          return false;
        }
      }
      if (selectedLocation) {
        if (!t.locationIds.includes(Number(selectedLocation))) {
          return false;
        }
      }
      if (selectedDays) {
        if (String(t.totalDays) !== selectedDays) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedTemplates, selectedDestination, selectedLocation, selectedDays]);

  // Handlers for dropdown changes ensuring smooth cascading updates
  const handleDestinationChange = (dest: string) => {
    setSelectedDestination(dest);
    setSelectedLocation(''); // Always reset location when changing destination
    // Check if selectedDays is still valid for this destination
    if (dest && selectedDays) {
      const destLower = dest.toLowerCase().trim();
      const stillValid = enrichedTemplates.some(
        (t) =>
          t.destinations.some((d) => d.toLowerCase().trim() === destLower) &&
          String(t.totalDays) === selectedDays
      );
      if (!stillValid) setSelectedDays('');
    }
    setSelectedTemplateId('');
  };

  const handleLocationChange = (locId: string) => {
    setSelectedLocation(locId);
    setSelectedTemplateId('');
  };

  const handleDaysChange = (days: string) => {
    setSelectedDays(days);
  };

  const handleTemplateSelect = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (!tplId) {
      if (!quoteId) {
        setInputs(blankInputs(m));
      }
      return;
    }
    applyTemplate(tplId);
  };

  const handleResetFilters = () => {
    setSelectedDestination('');
    setSelectedLocation('');
    setSelectedDays('');
    setSelectedTemplateId('');
    if (!quoteId) {
      setInputs(blankInputs(m));
    }
  };

  const hasActiveFilter = !!(selectedDestination || selectedLocation || selectedDays || selectedTemplateId);

  // Sync initial template if already populated
  useEffect(() => {
    if (inputs.template_id) {
      const match = enrichedTemplates.find((t) => t.id === inputs.template_id);
      if (match) {
        setSelectedTemplateId(String(match.id));
        if (match.destinations[0] && !selectedDestination) {
          setSelectedDestination(match.destinations[0]);
        }
        if (match.totalDays && !selectedDays) {
          setSelectedDays(String(match.totalDays));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nights = totalNights(inputs);

  return (
    <div className="space-y-6 pb-24">
      {/* 1. Page Header & Back Navigation */}
      <div className="space-y-2 border-b border-ink-100 pb-3">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push('/admin/quotations');
              }
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100 hover:text-brand-700 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <span className="text-ink-300">/</span>
          <Link
            href="/admin/quotations"
            className="font-medium text-ink-500 hover:text-brand-700 transition-colors"
          >
            Quotations
          </Link>
          {quoteId && (
            <>
              <span className="text-ink-300">/</span>
              <Link
                href={`/admin/quotations/${quoteId}`}
                className="font-medium text-ink-500 hover:text-brand-700 transition-colors"
              >
                {quoteNumber || 'View Quotation'}
              </Link>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">
              {quoteId ? `Edit quotation ${quoteNumber ?? ''}` : 'New quotation'}
            </h1>
            <p className="text-xs text-ink-500 sm:text-sm">
              {inputs.stays.length
                ? `${durationLabel(nights)} · ${inputs.stays.map((s) => locName(ctx, s.location_id)).join(' → ')}`
                : 'Autofill from a template or select route destinations below.'}
              {loading && (
                <span className="ml-2 inline-flex items-center gap-1 text-brand-700">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  loading rates…
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/admin/quotations');
                }
              }}
              className="btn-outline h-9 px-3 text-xs text-ink-600 hover:bg-ink-50 hover:text-ink-900"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1 inline" />
              <span>Back</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOP / MAIN SECTION: Unified Full-Width Form Card (High Density Admin Layout) */}
      <div className="space-y-4">
        <div className="card overflow-hidden border-ink-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="space-y-5">
            {/* Quick 4-Dropdown Template Selector */}
            <div className="rounded-xl border border-brand-200/80 bg-gradient-to-r from-brand-50/90 via-sky-50/60 to-sand-50/70 p-3 sm:p-4 shadow-2xs">
              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-brand-900">
                <Wand2 className="h-4 w-4 text-brand-700" />
                <span>Choose Template to Autofill:</span>
                <span className="hidden sm:inline text-[11px] font-normal text-ink-500">
                  (Filter by Destination, Location, or Days to autofill route &amp; hotels)
                </span>
              </div>

              {/* 4 Dropdowns in the same line */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
                {/* 1. Destination */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Destination
                  </label>
                  <select
                    className="input h-9 w-full bg-white text-xs py-1.5 px-2.5 border-ink-200 shadow-2xs font-medium text-ink-900"
                    value={selectedDestination}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    aria-label="Destination"
                  >
                    <option value="">All Destinations</option>
                    {destinationOptions.map((dest) => (
                      <option key={dest} value={dest}>
                        {dest}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Location */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1 flex items-center justify-between">
                    <span>Location</span>
                    {!selectedDestination && (
                      <span className="text-[10px] font-normal text-ink-400">
                        (Choose destination first)
                      </span>
                    )}
                  </label>
                  <select
                    className={cn(
                      'input h-9 w-full bg-white text-xs py-1.5 px-2.5 border-ink-200 shadow-2xs font-medium text-ink-900',
                      !selectedDestination && 'bg-sand-50/70 text-ink-400 cursor-not-allowed border-dashed'
                    )}
                    value={selectedLocation}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    disabled={!selectedDestination}
                    aria-label="Location"
                  >
                    {!selectedDestination ? (
                      <option value="">Select Destination first…</option>
                    ) : (
                      <>
                        <option value="">
                          {availableLocations.length === 0
                            ? `No locations under ${selectedDestination}`
                            : `All Locations in ${selectedDestination} (${availableLocations.length})`}
                        </option>
                        {availableLocations.map((loc) => (
                          <option key={loc.id} value={String(loc.id)}>
                            {loc.display_name || loc.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                {/* 3. Number of Days */}
                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Number of Days
                  </label>
                  <select
                    className="input h-9 w-full bg-white text-xs py-1.5 px-2.5 border-ink-200 shadow-2xs font-medium text-ink-900"
                    value={selectedDays}
                    onChange={(e) => handleDaysChange(e.target.value)}
                    aria-label="Number of Days"
                  >
                    <option value="">All Durations</option>
                    {availableDays.map((d) => (
                      <option key={d} value={String(d)}>
                        {d} Days ({d - 1} Nights)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Choose Template with Clear filter button on right */}
                <div>
                  <label className="block text-[11px] font-semibold text-brand-900 mb-1 flex items-center justify-between">
                    <span>Choose Template</span>
                    <span className="text-[10px] font-normal text-brand-700">
                      ({filteredTemplates.length} available)
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      className="input h-9 flex-1 min-w-0 bg-white text-xs py-1.5 px-2.5 border-brand-300 shadow-2xs font-semibold text-brand-950 focus:border-brand-600 focus:ring-1 focus:ring-brand-500"
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      aria-label="Choose Template"
                    >
                      <option value="">
                        {filteredTemplates.length === 0
                          ? 'No templates match filters'
                          : 'Choose a template to autofill…'}
                      </option>
                      {filteredTemplates.map((t) => (
                        <option key={t.id} value={t.idStr}>
                          {t.name} ({t.totalDays}D / {t.totalNights}N)
                        </option>
                      ))}
                    </select>
                    {hasActiveFilter && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex items-center gap-1 h-9 px-2.5 rounded border border-ink-200 bg-white text-xs font-medium text-ink-600 hover:text-red-600 hover:border-red-200 shadow-2xs transition-colors shrink-0 cursor-pointer"
                        title="Clear all filters"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Clear filter</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: Guest & Tour Specs (Dense 6-column grid) */}
            <div>
              <SectionHeader title="1. Guest & Trip Specifications" subtitle="Guest information, group composition, dates and category preference." />
              <GuestSection m={m} inputs={inputs} upd={upd} />
            </div>

            <hr className="border-ink-100" />

            {/* Section 2: Route & Hotels */}
            <div>
              <SectionHeader title="2. Route & Hotel Selection" subtitle="Night allocations and hotel selections per destination from Rate Master." />
              <StaysSection ctx={ctx} inputs={inputs} setInputs={setInputs} q1={q1} q2={q2} />
            </div>

            <hr className="border-ink-100" />

            {/* Section 3: Day-wise Itinerary */}
            <div>
              <SectionHeader title="3. Day-wise Itinerary" subtitle="Drag to reorder days. Dates and day numbering automatically re-sequence." />
              <DaysSection ctx={ctx} inputs={inputs} setInputs={setInputs} days={days} />
            </div>

            <hr className="border-ink-100" />

            {/* Section 4: Transport & Other Costs */}
            <div>
              <SectionHeader title="4. Transport & Additional Inclusions" subtitle="Vehicle assignment, estimated mileage, tolls, and package inclusions." />
              <TransportSection ctx={ctx} inputs={inputs} upd={upd} q1={q1} canOverrideMarkup={canOverrideMarkup} />
            </div>

            <hr className="border-ink-100" />

            {/* Section 5: Financial Summary */}
            <div>
              <SectionHeader title="5. Pricing Breakdown" subtitle="Real-time cost, markup, and tax calculation." />
              <PriceBreakdownSection q={q1} q2={q2} inputs={inputs} ctx={ctx} upd={upd} canOverrideMarkup={canOverrideMarkup} />
            </div>
          </div>
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="card sticky bottom-4 z-20 border-ink-200 bg-white/95 p-3.5 shadow-lg backdrop-blur sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Total Package Price</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-brand-700">₹{inr(q1.total)}</span>
                <span className="text-xs text-ink-500">₹{inr(q1.perPerson)} / adult</span>
                {q2 && (
                  <span className="text-xs font-semibold text-ocean-700">
                    (Option 2: ₹{inr(q2.total)})
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost text-xs sm:text-sm py-2 px-3 text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    router.back();
                  } else {
                    router.push('/admin/quotations');
                  }
                }}
                disabled={saving}
              >
                <ArrowLeft className="h-4 w-4 mr-1 inline" /> Back
              </button>
              <button
                type="button"
                className="btn-outline text-xs sm:text-sm py-2 px-4"
                disabled={saving}
                onClick={() => save('sent')}
              >
                <Send className="h-4 w-4" /> Save Quotation
              </button>
              <button
                type="button"
                className="btn-primary min-w-[130px] text-xs sm:text-sm py-2 px-4"
                disabled={saving}
                onClick={() => save(quoteId ? undefined : 'draft')}
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : quoteId ? 'Save changes' : 'Save as draft'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM SECTION: Full-Width Live Quotation Preview */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-ink-200 pb-2.5">
          <div>
            <h2 className="text-base font-semibold text-ink-900 sm:text-lg">Quotation Document Preview</h2>
            <p className="text-xs text-ink-500">Live preview of customer-facing quotation document (updates automatically)</p>
          </div>
        </div>
        <div className="card overflow-hidden border-ink-200 bg-white p-4 shadow-sm sm:p-8">
          <QuoteDocument s={snapshot} quoteNumber={quoteNumber} />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2.5">
      <h3 className="text-sm font-semibold text-ink-900 sm:text-base">{title}</h3>
      {subtitle && <p className="text-[11px] text-ink-500 sm:text-xs">{subtitle}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable Count Input (Proper text number input field with smooth typing)
// ---------------------------------------------------------------------------

function CountInput({
  value,
  onChange,
  min = 0,
  max,
  className = 'input h-8 text-xs py-1 px-2 font-medium',
  placeholder,
  allowEmpty,
  ariaLabel,
}: {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  min?: number;
  max?: number;
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  ariaLabel?: string;
}) {
  const [localVal, setLocalVal] = useState<string>(value != null ? String(value) : '');

  useEffect(() => {
    setLocalVal(value != null ? String(value) : '');
  }, [value]);

  return (
    <input
      type="number"
      min={min}
      max={max}
      className={className}
      value={localVal}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => {
        const text = e.target.value;
        setLocalVal(text);
        if (text === '') {
          if (allowEmpty) onChange(null);
        } else {
          const parsed = Number(text);
          if (!Number.isNaN(parsed)) {
            onChange(Math.max(min, parsed));
          }
        }
      }}
      onBlur={() => {
        if (localVal === '' || Number.isNaN(Number(localVal))) {
          if (allowEmpty) {
            setLocalVal('');
            onChange(null);
          } else {
            setLocalVal(String(min));
            onChange(min);
          }
        } else {
          const clamped = Math.max(min, Number(localVal));
          setLocalVal(String(clamped));
          onChange(clamped);
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Guest & trip (High Density Multi-Column Grid)
// ---------------------------------------------------------------------------

function GuestSection({
  m,
  inputs,
  upd,
}: {
  m: TourMasters;
  inputs: QuoteInputs;
  upd: (p: Partial<QuoteInputs>) => void;
}) {
  const pickups = m.points.filter((p) => p.use_for_pickup);
  const drops = m.points.filter((p) => p.use_for_drop);
  return (
    <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      <CustomerPicker inputs={inputs} upd={upd} className="col-span-1" />
      <Field label="Phone">
        <input className="input h-8 text-xs py-1 px-2" placeholder="Phone number" value={inputs.guest_phone} onChange={(e) => upd({ guest_phone: e.target.value })} />
      </Field>
      <Field label="Email">
        <input className="input h-8 text-xs py-1 px-2" type="email" placeholder="Email address" value={inputs.guest_email} onChange={(e) => upd({ guest_email: e.target.value })} />
      </Field>
      <Field label="Trip type">
        <select className="input h-8 text-xs py-1 px-1.5" value={inputs.trip_type} onChange={(e) => upd({ trip_type: e.target.value })}>
          {Array.from(new Set([...TRIP_TYPES, inputs.trip_type])).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Start date">
        <input className="input h-8 text-xs py-1 px-1.5" type="date" value={inputs.start_date} onChange={(e) => e.target.value && upd({ start_date: e.target.value })} />
      </Field>
      <Field label="Meal plan">
        <select className="input h-8 text-xs py-1 px-1.5" value={inputs.meal} onChange={(e) => upd({ meal: e.target.value as 'CP' | 'MAP' })}>
          <option value="CP">CP (Breakfast)</option>
          <option value="MAP">MAP (B&apos;fast+Din)</option>
        </select>
      </Field>
      <Field label="Adults">
        <CountInput
          value={inputs.adults}
          min={1}
          onChange={(val) => {
            const a = val ?? 1;
            upd({ adults: a, rooms: Math.max(inputs.rooms, Math.ceil(a / 3)) });
          }}
          ariaLabel="Adults"
        />
      </Field>
      <Field label="Rooms" hint={inputs.adults > inputs.rooms * 2 ? `${inputs.adults - inputs.rooms * 2} extra adult` : undefined}>
        <CountInput
          value={inputs.rooms}
          min={1}
          onChange={(val) => upd({ rooms: val ?? 1 })}
          ariaLabel="Rooms"
        />
      </Field>
      <Field label="Child bed (CWB)">
        <CountInput
          value={inputs.cwb}
          min={0}
          onChange={(val) => upd({ cwb: val ?? 0 })}
          ariaLabel="Child bed (CWB)"
        />
      </Field>
      <Field label="Child no bed (CNB)">
        <CountInput
          value={inputs.cnb}
          min={0}
          onChange={(val) => upd({ cnb: val ?? 0 })}
          ariaLabel="Child no bed (CNB)"
        />
      </Field>
      <Field label="Child ages" hint={inputs.cwb + inputs.cnb === 0 ? 'Optional' : undefined}>
        <input className="input h-8 text-xs py-1 px-2" value={inputs.child_ages} placeholder="e.g. 6, 9" onChange={(e) => upd({ child_ages: e.target.value })} />
      </Field>
      <Field label="Hotel category">
        <select className="input h-8 text-xs py-1 px-1.5" value={inputs.category_id ?? ''} onChange={(e) => upd({ category_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— Select —</option>
          {m.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="2nd option">
        <select className="input h-8 text-xs py-1 px-1.5" value={inputs.category2_id ?? ''} onChange={(e) => upd({ category2_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">None</option>
          {m.categories.filter((c) => c.id !== inputs.category_id).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pickup point">
        <select className="input h-8 text-xs py-1 px-1.5" value={inputs.pickup_point_id ?? ''} onChange={(e) => upd({ pickup_point_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— Select —</option>
          {pickups.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Drop point">
        <select className="input h-8 text-xs py-1 px-1.5" value={inputs.drop_point_id ?? ''} onChange={(e) => upd({ drop_point_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— Select —</option>
          {drops.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="GST Enable" hint={inputs.gst_enabled ? `${m.settings.gst_pct}% GST` : '0% GST'}>
        <label className="flex h-8 items-center gap-1.5 cursor-pointer rounded border border-ink-200 bg-white px-2 text-xs font-medium text-ink-800">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={Boolean(inputs.gst_enabled)}
            onChange={(e) => upd({ gst_enabled: e.target.checked })}
          />
          <span className="truncate">{inputs.gst_enabled ? `GST (${m.settings.gst_pct}%)` : 'GST'}</span>
        </label>
      </Field>
      <Field label="Quotation title" hint="Auto if empty">
        <input className="input h-8 text-xs py-1 px-2" placeholder="e.g. Kerala Package" value={inputs.title} onChange={(e) => upd({ title: e.target.value })} />
      </Field>
    </div>
  );
}

function CustomerPicker({ inputs, upd, className }: { inputs: QuoteInputs; upd: (p: Partial<QuoteInputs>) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ id: string; full_name: string; phone: string; email: string | null; city: string | null }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onChange = (v: string) => {
    upd({ guest_name: v, customer_id: null });
    clearTimeout(timer.current);
    if (v.trim().length < 2) return setResults([]);
    timer.current = setTimeout(async () => {
      setResults(await searchCustomers(v));
      setOpen(true);
    }, 250);
  };
  return (
    <div className={cn('relative', className)}>
      <Field label="Guest name *" hint={inputs.customer_id ? 'Linked to customer' : undefined}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            className="input h-8 pl-7 text-xs py-1 pr-2"
            placeholder="Search / enter name"
            value={inputs.guest_name}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        </div>
      </Field>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full min-w-[200px] overflow-hidden rounded-lg border border-ink-100 bg-white shadow-lg">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-brand-50"
                onMouseDown={() => {
                  upd({ customer_id: c.id, guest_name: c.full_name, guest_phone: c.phone ?? '', guest_email: c.email ?? '' });
                  setOpen(false);
                }}
              >
                <b className="text-ink-800">{c.full_name}</b> <span className="text-ink-400">· {c.phone}{c.city ? ` · ${c.city}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stays & hotels (Compact Horizontal Rows)
// ---------------------------------------------------------------------------

function StaysSection({
  ctx,
  inputs,
  setInputs,
  q1,
  q2,
}: {
  ctx: EngineCtx;
  inputs: QuoteInputs;
  setInputs: React.Dispatch<React.SetStateAction<QuoteInputs>>;
  q1: QuoteCalc;
  q2: QuoteCalc | null;
}) {
  const [addLoc, setAddLoc] = useState('');
  const locs = ctx.m.locations.filter((l) => l.is_active);
  const setStay = (i: number, patch: Partial<StayInput>) =>
    setInputs((s) => ({ ...s, stays: s.stays.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, d: -1 | 1) =>
    setInputs((s) => {
      const st = [...s.stays];
      const j = i + d;
      if (j < 0 || j >= st.length) return s;
      [st[i], st[j]] = [st[j]!, st[i]!];
      return { ...s, stays: st };
    });
  const remove = (i: number) => setInputs((s) => ({ ...s, stays: s.stays.filter((_, j) => j !== i) }));
  const add = () => {
    if (!addLoc) return;
    setInputs((s) => ({ ...s, stays: [...s.stays, newStay(Number(addLoc), 1)] }));
    setAddLoc('');
  };
  const byState = Array.from(new Set(locs.map((l) => l.state || 'Other')));

  return (
    <div className="space-y-2">
      {inputs.stays.length === 0 && (
        <p className="rounded-lg border border-dashed border-ink-200 p-2.5 text-center text-xs text-ink-400">
          No stays in route yet. Use the selector below to add destinations.
        </p>
      )}
      {inputs.stays.map((st, i) => (
        <div key={st.uid} className="rounded-lg border border-ink-100 bg-ink-50/40 p-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
              {i + 1}
            </span>
            <Field label="Location" className="min-w-[160px] flex-1">
              <div className="h-8 flex items-center justify-between px-2.5 rounded border border-ink-200 bg-white font-semibold text-xs text-ink-900 shadow-2xs">
                <span className="truncate">
                  {ctx.loc.get(st.location_id)?.display_name || ctx.loc.get(st.location_id)?.name || 'Location'}
                  {ctx.loc.get(st.location_id)?.is_houseboat && (
                    <span className="ml-1 text-[10px] text-brand-700 font-normal">(houseboat)</span>
                  )}
                </span>
                {ctx.loc.get(st.location_id)?.state && (
                  <span className="ml-2 text-[10px] text-ink-400 font-normal shrink-0">
                    {ctx.loc.get(st.location_id)?.state}
                  </span>
                )}
              </div>
            </Field>
            <Field label="Nights" className="w-20">
              <CountInput
                value={st.nights}
                min={1}
                className="input h-8 text-xs py-1 px-2 w-full font-medium"
                onChange={(val) => setStay(i, { nights: val ?? 1 })}
                ariaLabel="Nights"
              />
            </Field>
            <div className="flex gap-1 pb-0.5">
              <IconBtn title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp className="h-3 w-3" />
              </IconBtn>
              <IconBtn title="Move down" onClick={() => move(i, 1)} disabled={i === inputs.stays.length - 1}>
                <ArrowDown className="h-3 w-3" />
              </IconBtn>
              <IconBtn title="Remove" onClick={() => remove(i)} danger>
                <Trash2 className="h-3 w-3" />
              </IconBtn>
            </div>
            <span className="pb-1 text-xs text-ink-400">
              {stayDates(inputs, i).length ? `${fmtDay(stayDates(inputs, i)[0]!)} (${st.nights}N)` : ''}
            </span>
          </div>
          <HotelRow ctx={ctx} inputs={inputs} si={i} which={1} q={q1} setPick={(p) => setStay(i, { opt1: p })} />
          {q2 && <HotelRow ctx={ctx} inputs={inputs} si={i} which={2} q={q2} setPick={(p) => setStay(i, { opt2: p })} />}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <select
          className="input h-8 w-auto min-w-[200px] text-xs py-1 px-2"
          value={addLoc}
          onChange={(e) => setAddLoc(e.target.value)}
          aria-label="Add stay location"
        >
          <option value="">+ Add destination stay…</option>
          <LocationOptions locs={locs} states={byState} />
        </select>
        <button type="button" className="btn-outline h-8 px-3 text-xs" onClick={add} disabled={!addLoc}>
          <Plus className="h-3.5 w-3.5" /> Add stay
        </button>
      </div>
    </div>
  );
}

const blankPick = (): HotelPick => ({ hotel_id: null, room_type_id: null, manual_rate: null, additional_cost: null });

function LocationOptions({ locs, states }: { locs: TourMasters['locations']; states: string[] }) {
  return (
    <>
      {states.map((s) => (
        <optgroup key={s} label={s}>
          {locs
            .filter((l) => (l.state || 'Other') === s)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.display_name || l.name}
                {l.is_houseboat ? ' (houseboat)' : ''}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

function HotelRow({
  ctx,
  inputs,
  si,
  which,
  q,
  setPick,
}: {
  ctx: EngineCtx;
  inputs: QuoteInputs;
  si: number;
  which: 1 | 2;
  q: QuoteCalc;
  setPick: (p: HotelPick) => void;
}) {
  const st = inputs.stays[si]!;
  const pick = which === 2 ? st.opt2 : st.opt1;
  const sp = q.stays[si];
  const ch = sp?.choice;
  const catId = which === 2 ? inputs.category2_id : inputs.category_id;
  const catName = ctx.m.categories.find((c) => c.id === catId)?.name ?? 'category';
  const hotels = hotelsIn(ctx, st.location_id);
  const catNames = (h: (typeof hotels)[number]) =>
    Array.from(h.cats)
      .map((c) => ctx.m.categories.find((x) => x.id === c)?.name)
      .filter(Boolean)
      .join(', ');
  const seasons = Array.from(
    new Set(
      (sp?.nights ?? [])
        .map((n) => (n.row ? `${n.row.season.replace(' Season', '').replace(' Window', '')}${n.exact ? '' : ' (guessed)'}` : n.manual != null ? 'Manual' : ''))
        .filter(Boolean)
    )
  );

  // Split hotels into active category vs other categories
  const categoryHotels = catId != null ? hotels.filter((h) => h.cats.has(catId)) : hotels;
  const otherHotels = catId != null ? hotels.filter((h) => !h.cats.has(catId)) : [];
  const otherCategoryGroups = ctx.m.categories
    .filter((c) => c.id !== catId)
    .map((c) => ({
      category: c,
      hotels: otherHotels.filter((h) => h.cats.has(c.id)),
    }))
    .filter((g) => g.hotels.length > 0);

  const groupedIds = new Set([
    ...categoryHotels.map((h) => h.id),
    ...otherCategoryGroups.flatMap((g) => g.hotels.map((h) => h.id)),
  ]);
  const uncategorizedHotels = otherHotels.filter((h) => !groupedIds.has(h.id));

  return (
    <div
      className={cn(
        'mt-2 grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_auto]',
        which === 2 ? 'border-ocean-200 bg-ocean-50/60' : 'border-ink-100 bg-white'
      )}
    >
      <Field label={which === 2 ? `Option 2 hotel (${catName})` : `Hotel (${catName})`}>
        <select
          className="input h-8 text-xs py-1 px-2"
          value={pick.hotel_id == null ? '' : String(pick.hotel_id)}
          onChange={(e) => {
            const v = e.target.value;
            setPick({
              hotel_id: v === '' ? null : v === 'tbc' ? 'tbc' : Number(v),
              room_type_id: null,
              manual_rate: pick.manual_rate,
              additional_cost: pick.additional_cost,
            });
          }}
        >
          <option value="">
            Best value in {catName || 'category'} (Auto)
          </option>

          {categoryHotels.length > 0 && (
            <optgroup label={`${catName || 'Selected Category'} Hotels`}>
              {categoryHotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} {catNames(h) ? `(${catNames(h)})` : ''}
                </option>
              ))}
            </optgroup>
          )}

          {otherCategoryGroups.map((g) => (
            <optgroup key={g.category.id} label={`${g.category.name} Hotels`}>
              {g.hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} {catNames(h) ? `(${catNames(h)})` : ''}
                </option>
              ))}
            </optgroup>
          ))}

          {uncategorizedHotels.length > 0 && (
            <optgroup label="Other Categories / Hotels">
              {uncategorizedHotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </optgroup>
          )}

          <option value="tbc">Similar category (TBC) – enter custom rate</option>
        </select>

        {ch?.auto && ch.H && (
          <div className="mt-1 flex items-center justify-between rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 border border-emerald-200">
            <span className="truncate pr-2">
              <b>Auto:</b> {ch.H.name} {ch.roomName ? `· ${ch.roomName}` : ''}
            </span>
            <span className="font-semibold tabular-nums shrink-0">
              Budget ({st.nights}N): ₹{inr(sp?.total ?? 0)}
            </span>
          </div>
        )}
      </Field>

      {ch?.H ? (
        <Field label="Room">
          <select
            className="input h-8 text-xs py-1 px-2"
            value={ch.roomId ?? ''}
            onChange={(e) =>
              setPick({
                hotel_id: ch.H!.id,
                room_type_id: Number(e.target.value),
                manual_rate: null,
                additional_cost: pick.additional_cost,
              })
            }
          >
            {Array.from(ch.H.rooms.values()).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label={`Rate / ${ctx.loc.get(st.location_id)?.is_houseboat ? 'boat' : 'room'} / night (₹)`}>
          <input
            className="input h-8 text-xs py-1 px-2"
            type="number"
            min={0}
            value={pick.manual_rate ?? ''}
            onChange={(e) =>
              setPick({
                ...pick,
                manual_rate: e.target.value === '' ? null : num(e.target.value),
              })
            }
          />
        </Field>
      )}

      {/* Additional cost input field */}
      <Field label="Additional cost (₹)" hint="Adds to stay">
        <input
          className="input h-8 text-xs py-1 px-2 font-medium"
          type="number"
          min={0}
          placeholder="0"
          value={pick.additional_cost ?? ''}
          onChange={(e) =>
            setPick({
              ...pick,
              additional_cost: e.target.value === '' ? null : Math.max(0, num(e.target.value)),
            })
          }
        />
      </Field>

      <div className="min-w-[130px] text-right flex flex-col justify-between">
        <div>
          <p className="text-[11px] text-ink-400">
            {st.nights} night{st.nights > 1 ? 's' : ''}
          </p>
          <p className="text-sm font-semibold tabular-nums text-ink-900">₹{inr(sp?.total ?? 0)}</p>
          {pick.additional_cost ? (
            <p className="text-[10px] font-medium text-brand-700 tabular-nums">
              (+₹{inr(pick.additional_cost)} addl)
            </p>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap justify-end gap-1">
          {seasons.map((s) => (
            <span
              key={s}
              className={cn(
                'badge py-0 px-1.5 text-[10px]',
                s.includes('guessed')
                  ? 'bg-sand-100 text-sand-800'
                  : s.startsWith('Peak')
                    ? 'bg-coral-50 text-coral-700'
                    : s.startsWith('Lean')
                      ? 'bg-brand-50 text-brand-800'
                      : 'bg-ocean-50 text-ocean-800'
              )}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      {sp && sp.nights.length > 0 && ch?.H && (
        <details className="text-[11px] text-ink-500 sm:col-span-4">
          <summary className="cursor-pointer select-none font-medium text-brand-700 hover:underline">
            Night-by-night pricing breakdown
          </summary>
          <table className="mt-1.5 w-full">
            <tbody>
              {sp.nights.map((n) => (
                <tr key={n.date} className="border-t border-ink-100">
                  <td className="py-0.5 pr-2">{fmtDay(n.date)}</td>
                  <td className="py-0.5 pr-2">{n.row ? `${n.row.season} · ${n.row.date_range_label}` : '—'}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {n.base != null
                      ? `₹${inr(n.base)} × ${n.units}${n.extras ? ` + ₹${inr(n.extras)} extras` : ''} = ₹${inr(n.total ?? 0)}`
                      : 'no price'}
                  </td>
                </tr>
              ))}
              {pick.additional_cost ? (
                <tr className="border-t border-ink-200 font-medium text-brand-800 bg-brand-50/50">
                  <td className="py-0.5 pr-2" colSpan={2}>
                    Additional cost
                  </td>
                  <td className="py-0.5 text-right tabular-nums">+₹{inr(pick.additional_cost)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day-wise itinerary (Compact Drag-and-Drop)
// ---------------------------------------------------------------------------

function DaysSection({
  ctx,
  inputs,
  setInputs,
  days,
}: {
  ctx: EngineCtx;
  inputs: QuoteInputs;
  setInputs: React.Dispatch<React.SetStateAction<QuoteInputs>>;
  days: DayOut[];
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const edit = (d: DayOut, patch: Partial<DayEdit>) =>
    setInputs((s) => {
      const cur = s.days[d.ak];
      const base: DayEdit = cur && cur.k === d.key ? cur : { k: d.key, note: cur?.note, custom: cur?.custom };
      return { ...s, days: { ...s.days, [d.ak]: { ...base, ...patch } } };
    });

  const reset = (d: DayOut) =>
    setInputs((s) => {
      const next = { ...s.days };
      delete next[d.ak];
      return { ...s, days: next };
    });

  const reorderDays = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= days.length || toIdx >= days.length) return;
    const currentOrder = days.map((d) => d.ak);
    const [movedAk] = currentOrder.splice(fromIdx, 1);
    if (movedAk) {
      currentOrder.splice(toIdx, 0, movedAk);
      setInputs((s) => ({ ...s, day_order: currentOrder }));
    }
  };

  const resetOrder = () => {
    setInputs((s) => ({ ...s, day_order: undefined }));
  };

  if (!days.length) {
    return (
      <div className="rounded-lg border border-dashed border-ink-200 bg-sand-50/40 p-6 text-center">
        <p className="text-xs font-semibold text-ink-700">
          No itinerary days to display
        </p>
        <p className="mt-1 text-[11px] text-ink-500">
          Choose a package from the template selector above to generate the day-wise itinerary.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {inputs.day_order && inputs.day_order.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-sand-50 px-2.5 py-1 text-xs text-sand-900">
          <span>Custom itinerary day order applied.</span>
          <button
            type="button"
            onClick={resetOrder}
            className="flex items-center gap-1 font-medium text-brand-700 hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> Reset order
          </button>
        </div>
      )}
      <div className="space-y-1.5">
        {days.map((d, index) => (
          <DayCard
            key={d.ak}
            ctx={ctx}
            d={d}
            index={index}
            totalDays={days.length}
            isDragging={draggedIndex === index}
            isDragOver={dragOverIndex === index}
            onDragStart={(e) => {
              setDraggedIndex(index);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(index));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverIndex !== index) setDragOverIndex(index);
            }}
            onDragLeave={() => {
              if (dragOverIndex === index) setDragOverIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedIndex !== null && draggedIndex !== index) {
                reorderDays(draggedIndex, index);
              }
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            onDragEnd={() => {
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            onMoveUp={() => reorderDays(index, index - 1)}
            onMoveDown={() => reorderDays(index, index + 1)}
            inputs={inputs}
            edit={(p) => edit(d, p)}
            reset={() => reset(d)}
            edited={!!inputs.days[d.ak]}
            titleEdit={inputs.days[d.ak]?.k === d.key ? inputs.days[d.ak]?.title ?? '' : ''}
          />
        ))}
      </div>
    </div>
  );
}

function ActivitySearchSelect({
  activities,
  allActivities,
  locName,
  onSelect,
}: {
  activities: TourMasters['activities'];
  allActivities: TourMasters['activities'];
  locName: string;
  onSelect: (name: string) => void;
}) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInputText, setCustomInputText] = useState('');
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCustomMode) {
      customInputRef.current?.focus();
    }
  }, [isCustomMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveCustom = () => {
    const trimmed = customInputText.trim();
    if (!trimmed) return;
    onSelect(trimmed);
    setCustomInputText('');
    setIsCustomMode(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activities;
    const local = activities.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.kind && a.kind.toLowerCase().includes(q))
    );
    const localIds = new Set(local.map((a) => a.id));
    const others = allActivities.filter(
      (a) =>
        !localIds.has(a.id) &&
        (a.name.toLowerCase().includes(q) ||
          (a.category && a.category.toLowerCase().includes(q)) ||
          (a.kind && a.kind.toLowerCase().includes(q)))
    );
    return [...local, ...others];
  }, [activities, allActivities, query]);

  // When custom mode is active, the dropdown field changes directly to an input field
  if (isCustomMode) {
    return (
      <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
        <div className="relative flex-1">
          <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-600 pointer-events-none" />
          <input
            ref={customInputRef}
            type="text"
            className="input h-8 w-full pl-8 pr-3 text-xs font-medium text-ink-900 border-brand-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white placeholder:text-ink-400"
            placeholder="Type custom activity or plan (press Enter to add)…"
            value={customInputText}
            onChange={(e) => setCustomInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveCustom();
              } else if (e.key === 'Escape') {
                setIsCustomMode(false);
                setCustomInputText('');
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleSaveCustom}
          disabled={!customInputText.trim()}
          className="btn-primary h-8 px-3 text-xs inline-flex items-center gap-1 shrink-0 disabled:opacity-40 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setIsCustomMode(false);
            setCustomInputText('');
          }}
          className="btn-outline h-8 px-2.5 text-xs text-ink-600 hover:text-ink-900 inline-flex items-center gap-1 shrink-0 bg-white cursor-pointer"
          title="Back to dropdown"
        >
          <RotateCcw className="h-3 w-3" />
          <span className="hidden sm:inline">Choose from list</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[240px]">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400 pointer-events-none" />
        <input
          type="text"
          className="input h-8 w-full pl-8 pr-8 text-xs font-medium text-brand-950 placeholder:text-ink-400 border-brand-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white cursor-pointer"
          placeholder={
            activities.length === 0
              ? `Choose or search activity in ${locName || 'this destination'}…`
              : `Select activity in ${locName || 'destination'} (${activities.length} available)…`
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered.length > 0) {
                onSelect(filtered[0]!.name);
                setQuery('');
                setIsOpen(false);
              } else if (query.trim()) {
                onSelect(query.trim());
                setQuery('');
                setIsOpen(false);
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ink-400 hover:text-ink-700 rounded"
            onClick={() => {
              setQuery('');
              setIsOpen(true);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ink-400 hover:text-ink-700"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-ink-200 bg-white py-1 shadow-xl text-xs">
          {/* Option for custom creating inside the dropdown */}
          <button
            type="button"
            className="w-full text-left px-3 py-2 bg-brand-50/90 hover:bg-brand-100 text-brand-900 font-semibold flex items-center justify-between gap-2 border-b border-brand-200 transition-colors cursor-pointer"
            onClick={() => {
              setIsCustomMode(true);
              setIsOpen(false);
              if (query.trim()) {
                setCustomInputText(query.trim());
              }
            }}
          >
            <span className="flex items-center gap-1.5 truncate">
              <Sparkles className="h-3.5 w-3.5 text-brand-600 shrink-0" />
              <span>
                {query.trim()
                  ? `+ Create custom activity: "${query.trim()}"`
                  : '+ Create Custom Activity…'}
              </span>
            </span>
            <span className="text-[10px] text-brand-700 font-normal shrink-0">
              Switch to text input
            </span>
          </button>

          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-ink-400 text-center italic">
              No matching activities. Click above to create &quot;{query}&quot; as custom.
            </div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-brand-50 hover:text-brand-900 flex items-center justify-between gap-2 border-b border-ink-50 last:border-b-0 transition-colors cursor-pointer"
                onClick={() => {
                  onSelect(a.name);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                <span className="font-medium text-ink-900 truncate">{a.name}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {a.kind && (
                    <span className="badge py-0 px-1 text-[9px] bg-sand-100 text-sand-800">
                      {a.kind}
                    </span>
                  )}
                  {a.entry_fee_adult != null && a.entry_fee_adult > 0 && (
                    <span className="text-[10px] text-ink-500 tabular-nums">
                      ₹{a.entry_fee_adult}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DayCard({
  ctx,
  d,
  index,
  totalDays,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  inputs,
  edit,
  reset,
  edited,
  titleEdit,
}: {
  ctx: EngineCtx;
  d: DayOut;
  index: number;
  totalDays: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  inputs: QuoteInputs;
  edit: (p: Partial<DayEdit>) => void;
  reset: () => void;
  edited: boolean;
  titleEdit: string;
}) {
  const [open, setOpen] = useState(false);

  // Day's primary destination/location
  const dayLocationId = d.to ?? d.city ?? d.from ?? null;
  const currentLocName = locName(ctx, dayLocationId);

  // Sights on this day
  const sights = useMemo(
    () => d.lines.filter((l): l is (DayLine & { kind: 'sight' }) => l.kind === 'sight'),
    [d.lines]
  );

  const present = useMemo(
    () => new Set(sights.filter((s) => !s.off).map((s) => s.name)),
    [sights]
  );

  // Available activities filtered for this day's location (and fallback to all)
  const locationActivities = useMemo(() => {
    if (!dayLocationId) {
      return ctx.m.activities.filter((a) => a.is_active && !present.has(a.name));
    }
    const targetLoc = ctx.loc.get(dayLocationId);
    const pId = targetLoc?.parent_id;
    const ids = new Set<number>([dayLocationId]);
    if (pId) ids.add(pId);
    ctx.m.locations.filter((l) => l.parent_id === dayLocationId).forEach((l) => ids.add(l.id));

    const direct = ctx.m.activities.filter(
      (a) => a.is_active && !present.has(a.name) && ids.has(a.location_id)
    );
    if (direct.length > 0) return direct;
    return ctx.m.activities.filter((a) => a.is_active && !present.has(a.name));
  }, [ctx, dayLocationId, present]);

  const allAvailableActivities = useMemo(
    () => ctx.m.activities.filter((a) => a.is_active && !present.has(a.name)),
    [ctx.m.activities, present]
  );

  const handleAddActivity = (name: string) => {
    const currentAdded = d.lines
      .filter((x) => x.kind === 'sight' && x.added)
      .map((x) => (x.kind === 'sight' ? x.name : ''));
    const allCurrentNames = sights.map((s) => s.name);
    edit({
      add: [...currentAdded, name],
      sight_order: [...allCurrentNames, name],
    });
  };

  const moveSight = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= sights.length) return;
    const names = sights.map((s) => s.name);
    const [moved] = names.splice(fromIdx, 1);
    if (!moved) return;
    names.splice(toIdx, 0, moved);
    edit({ sight_order: names });
  };

  const removeSight = (s: DayLine & { kind: 'sight' }) => {
    if (s.added) {
      const nextAdded = d.lines
        .filter((x) => x.kind === 'sight' && x.added && x.name !== s.name)
        .map((x) => (x.kind === 'sight' ? x.name : ''));
      const nextOrder = sights.filter((x) => x.name !== s.name).map((x) => x.name);
      edit({ add: nextAdded, sight_order: nextOrder });
    } else if (s.ix != null) {
      const off = new Set(
        d.lines
          .filter((x) => x.kind === 'sight' && x.off && x.ix != null)
          .map((x) => (x.kind === 'sight' ? x.ix! : -1))
      );
      off.add(s.ix);
      edit({ off: Array.from(off) });
    }
  };

  const kindLabel = { arrival: 'Arrival', transfer: 'Travel', stay: 'Stay', departure: 'Departure' }[d.kind];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'rounded-lg border transition-all duration-150',
        isDragging && 'opacity-40 ring-2 ring-brand-500 scale-[0.99]',
        isDragOver && 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500',
        !isDragging && !isDragOver && 'border-ink-100 bg-white hover:border-ink-200'
      )}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        {/* Drag handle */}
        <div
          className="cursor-grab p-1 text-ink-400 hover:text-ink-700 active:cursor-grabbing"
          title="Drag to reorder day"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)}>
          <span className="shrink-0 rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold text-white">D{d.i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] text-ink-400">
              {fmtDay(d.date)} · {kindLabel}
              {dayLocationId ? ` · ${locName(ctx, dayLocationId)}` : ''}
            </span>
            <span className="block truncate text-xs font-medium text-ink-800">{d.title}</span>
          </span>
          {d.stale && <span className="badge py-0 px-1 text-[9px] bg-sand-100 text-sand-800">route changed</span>}
          {edited && <span className="badge py-0 px-1 text-[9px] bg-ocean-50 text-ocean-800">edited</span>}
          <ChevronDown className={cn('h-3.5 w-3.5 text-ink-400 transition-transform', open && 'rotate-180')} />
        </button>

        {/* Quick move buttons */}
        <div className="flex items-center gap-0.5 border-l border-ink-100 pl-1">
          <button
            type="button"
            title="Move Day Up"
            disabled={index === 0}
            onClick={onMoveUp}
            className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-20"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Move Day Down"
            disabled={index === totalDays - 1}
            onClick={onMoveDown}
            className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-20"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-2.5 border-t border-ink-100 p-2.5 bg-ink-50/30">
          <div>
            <Field label="Day title">
              <input
                className="input h-8 text-xs py-1 px-2 font-medium"
                placeholder={d.title}
                value={titleEdit}
                onChange={(e) => edit({ title: e.target.value })}
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            {d.lines.map((l, i) => {
              if (l.kind !== 'sight') {
                return (
                  <div key={i} className="pl-6 py-0.5 text-ink-500 italic text-[11px]">
                    {l.text}
                  </div>
                );
              }

              const sightIdx = sights.findIndex((s) => s.name === l.name);

              return (
                <div
                  key={`${l.name}-${i}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(sightIdx));
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData('text/plain'));
                    if (!Number.isNaN(from) && from !== sightIdx) {
                      moveSight(from, sightIdx);
                    }
                  }}
                  className={cn(
                    'group flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors',
                    l.off
                      ? 'border-dashed border-ink-200 bg-ink-50/50 text-ink-400'
                      : l.added
                        ? 'border-brand-200 bg-brand-50/40 text-ink-900'
                        : 'border-ink-150 bg-white hover:border-ink-300'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Drag handle */}
                    <span
                      className="cursor-grab text-ink-300 group-hover:text-ink-600 active:cursor-grabbing p-0.5"
                      title="Drag to rearrange"
                    >
                      <GripVertical className="h-3 w-3" />
                    </span>

                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      className="rounded border-ink-300 text-brand-700 focus:ring-brand-500"
                      checked={!l.off}
                      onChange={(e) => {
                        if (l.added) {
                          if (!e.target.checked) removeSight(l);
                          return;
                        }
                        const off = new Set(
                          d.lines
                            .filter((x) => x.kind === 'sight' && x.off && x.ix != null)
                            .map((x) => (x.kind === 'sight' ? x.ix! : -1))
                        );
                        if (e.target.checked) off.delete(l.ix!);
                        else off.add(l.ix!);
                        edit({ off: Array.from(off) });
                      }}
                      title={l.off ? 'Click to include' : 'Click to exclude'}
                    />

                    {/* Name & Description */}
                    <div className="min-w-0 flex-1 truncate">
                      <span className={cn('font-medium', l.off ? 'line-through text-ink-400' : 'text-ink-900')}>
                        {l.name}
                      </span>
                      {l.desc && (
                        <span className={cn('ml-1.5 text-[11px]', l.off ? 'text-ink-300' : 'text-ink-500')}>
                          – {l.desc}
                        </span>
                      )}
                      {l.added && (
                        <span className="badge ml-1.5 py-0 px-1 text-[9px] bg-brand-100 text-brand-800 font-semibold">
                          added
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Move Up / Move Down / Delete */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-20"
                      title="Move Up"
                      disabled={sightIdx <= 0}
                      onClick={() => moveSight(sightIdx, sightIdx - 1)}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-20"
                      title="Move Down"
                      disabled={sightIdx < 0 || sightIdx >= sights.length - 1}
                      onClick={() => moveSight(sightIdx, sightIdx + 1)}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-ink-400 hover:bg-coral-50 hover:text-coral-700"
                      title={l.added ? 'Remove activity' : 'Exclude from itinerary'}
                      onClick={() => removeSight(l)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-ink-100">
            {/* Single activity selecting dropdown with option to switch to custom creating input */}
            <Field label={`Activity / Sightseeing ${currentLocName ? `(${currentLocName})` : ''}`}>
              <ActivitySearchSelect
                activities={locationActivities}
                allActivities={allAvailableActivities}
                locName={currentLocName}
                onSelect={handleAddActivity}
              />
            </Field>
          </div>

          {d.tip && <p className="rounded-lg bg-sand-50 px-2 py-1 text-[11px] text-sand-900">{d.tip}</p>}

          <Field label="Note for guest">
            <input className="input h-8 text-xs py-1 px-2" value={d.note} onChange={(e) => edit({ note: e.target.value })} />
          </Field>
          <div className="flex items-center justify-between text-[11px] text-ink-400">
            <span>Meals: {d.meals}</span>
            {edited && (
              <button
                type="button"
                className="text-coral-700 hover:underline"
                onClick={() => {
                  reset();
                }}
              >
                Reset this day
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transport & pricing (High Density Multi-Column Grid)
// ---------------------------------------------------------------------------

function TransportSection({
  ctx,
  inputs,
  upd,
  q1,
  canOverrideMarkup,
}: {
  ctx: EngineCtx;
  inputs: QuoteInputs;
  upd: (p: Partial<QuoteInputs>) => void;
  q1: QuoteCalc;
  canOverrideMarkup: boolean;
}) {
  const V = q1.vehicle;
  const veh = ctx.m.vehicles.find((v) => v.id === inputs.vehicle_id);
  const pax = inputs.adults + inputs.cwb + inputs.cnb;
  const types = Array.from(new Set(ctx.m.vehicles.map((v) => v.vehicle_type)));

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        <Field
          label="Vehicle"
          className="col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-2"
          hint={
            veh
              ? `${veh.company_name} · ₹${inr(veh.amount)} ${veh.rate_basis === 'per_day' ? '/day' : '/trip'}, ${veh.free_km}km free`
              : ctx.m.vehicles.length
                ? undefined
                : 'No vehicles found'
          }
        >
          <select
            className="input h-8 text-xs py-1 px-1.5"
            value={inputs.vehicle_id ?? ''}
            onChange={(e) => upd({ vehicle_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Select a vehicle…</option>
            {types.map((t) => (
              <optgroup key={t} label={t}>
                {ctx.m.vehicles
                  .filter((v) => v.vehicle_type === t)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name} – ₹{inr(v.amount)} {v.rate_basis === 'per_day' ? '/day' : '/trip'}
                      {v.seats ? ` · ${v.seats} seats` : ''}
                      {v.seats && v.seats < pax ? ' (too small)' : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Vehicle days" hint={`Default ${totalNights(inputs) + 1}`}>
          <CountInput
            value={inputs.vehicle_days}
            min={1}
            allowEmpty
            placeholder={String(totalNights(inputs) + 1)}
            onChange={(val) => upd({ vehicle_days: val })}
            ariaLabel="Vehicle days"
          />
        </Field>
        <Field label="Total km" hint={`Est: ${inr(V.kmEstimated)} km`}>
          <input
            className="input h-8 text-xs py-1 px-2"
            type="number"
            min={0}
            placeholder={String(V.kmEstimated)}
            value={inputs.vehicle_km ?? ''}
            onChange={(e) => upd({ vehicle_km: e.target.value === '' ? null : num(e.target.value) })}
          />
        </Field>
        <Field label="Tolls/permits (₹)">
          <input className="input h-8 text-xs py-1 px-2" type="number" min={0} value={inputs.vehicle_extra || ''} onChange={(e) => upd({ vehicle_extra: num(e.target.value) })} />
        </Field>
        <Field
          label="Markup %"
          hint={canOverrideMarkup ? `Std: ${ctx.m.settings.markup_pct}%` : 'Admin locked'}
        >
          <input
            className="input h-8 text-xs py-1 px-2"
            type="number"
            min={0}
            max={100}
            disabled={!canOverrideMarkup}
            placeholder={String(ctx.m.settings.markup_pct)}
            value={canOverrideMarkup ? inputs.markup_pct ?? '' : ctx.m.settings.markup_pct}
            onChange={(e) => upd({ markup_pct: e.target.value === '' ? null : num(e.target.value) })}
          />
        </Field>
        <Field label="Valid until">
          <input className="input h-8 text-xs py-1 px-1.5" type="date" value={inputs.valid_until ?? ''} onChange={(e) => upd({ valid_until: e.target.value || null })} />
        </Field>
        <Field label="Internal notes (private)" className="col-span-2 sm:col-span-3 md:col-span-2 lg:col-span-2 xl:col-span-1">
          <input className="input h-8 text-xs py-1 px-2" placeholder="Private internal notes" value={inputs.notes} onChange={(e) => upd({ notes: e.target.value })} />
        </Field>
      </div>

      {V.legs.length > 0 && (
        <div className="rounded-lg bg-ink-50/70 p-2 text-[11px] text-ink-600">
          <span className="font-semibold text-ink-700">KM Route estimate: </span>
          {V.legs.map((l, i) => (
            <span key={i} className="mr-3 inline-block">
              {l.from} → {l.to}: {l.km == null ? <b className="text-coral-700">missing</b> : `${inr(l.km)} km`}
            </span>
          ))}
          {ctx.m.settings.sightseeing_km_per_day > 0 && (
            <span className="mr-3 inline-block">+ local {ctx.m.settings.sightseeing_km_per_day} km/day</span>
          )}
          {veh && (
            <span className="inline-block font-medium text-ink-800">
              ({inr(V.km)} km − {inr(V.freeKm)} free = {inr(V.extraKm)} extra km × ₹{inr(veh.extra_per_km)} = ₹{inr(V.extraKmCost)})
            </span>
          )}
        </div>
      )}

      <div className="grid gap-2.5 md:grid-cols-2 pt-0.5">
        <div>
          <label className="label text-xs font-semibold text-ink-700 mb-1">Other costs (entry tickets, guide, activities…)</label>
          <div className="space-y-1.5">
            {(inputs.others || []).map((o, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  className="input h-8 flex-1 text-xs py-1 px-2"
                  placeholder="Cost description"
                  value={o.label}
                  onChange={(e) =>
                    upd({ others: (inputs.others || []).map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                  }
                />
                <input
                  className="input h-8 w-28 text-xs py-1 px-2"
                  type="number"
                  min={0}
                  placeholder="₹"
                  value={o.amount || ''}
                  onChange={(e) =>
                    upd({ others: (inputs.others || []).map((x, j) => (j === i ? { ...x, amount: num(e.target.value) } : x)) })
                  }
                />
                <IconBtn title="Remove" danger onClick={() => upd({ others: (inputs.others || []).filter((_, j) => j !== i) })}>
                  <X className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            ))}
            <button
              type="button"
              className="btn-ghost h-7 px-2.5 text-xs"
              onClick={() => upd({ others: [...(inputs.others || []), { label: '', amount: 0 }] })}
            >
              <Plus className="h-3 w-3" /> Add cost item
            </button>
          </div>
        </div>

        <div>
          <Field label="Extra inclusions (one per line)">
            <textarea
              className="input text-xs py-1.5 px-2"
              rows={2}
              value={inputs.extra_inclusions}
              onChange={(e) => upd({ extra_inclusions: e.target.value })}
              placeholder="e.g. Candlelight dinner on houseboat, Flower bed decoration"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-form Financial Breakdown
// ---------------------------------------------------------------------------

function PriceBreakdownSection({
  q,
  q2,
  inputs,
  ctx,
  upd,
  canOverrideMarkup,
}: {
  q: QuoteCalc;
  q2: QuoteCalc | null;
  inputs: QuoteInputs;
  ctx: EngineCtx;
  upd: (p: Partial<QuoteInputs>) => void;
  canOverrideMarkup: boolean;
}) {
  const row = (label: string, v: number, strong = false) => (
    <div className={cn('flex justify-between py-0.5 text-xs', strong && 'border-t border-ink-100 pt-1 font-semibold text-ink-900')}>
      <span className="text-ink-600">{label}</span>
      <span className="tabular-nums font-medium text-ink-800">₹{inr(v)}</span>
    </div>
  );
  const cat = (id: number | null) => ctx.m.categories.find((c) => c.id === id)?.name ?? '';

  const handleCustomTotal = (newTotal: number) => {
    if (newTotal > 0 && q.net > 0) {
      const newMp = deriveMarkupPctFromTotal(q.net, newTotal, q.gstPct);
      upd({ markup_pct: newMp });
    }
  };

  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      <div className="rounded-lg border border-ink-100 bg-ink-50/40 p-2.5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-600">
          Option 1 {cat(inputs.category_id) ? `(${cat(inputs.category_id)})` : ''}
        </p>
        {row('Hotels', q.hotels)}
        {row(`Vehicle${q.vehicle.days ? ` (${q.vehicle.days} days)` : ''}`, q.vehicle.total)}
        {q.other > 0 && row('Other costs', q.other)}
        {row('Net cost', q.net, true)}
        {row(`Markup (${q.markupPct}%)`, q.markup)}
        {inputs.gst_enabled && q.gstPct > 0 ? (
          row(`GST (${q.gstPct}%)`, q.gst)
        ) : (
          <div className="flex justify-between py-0.5 text-xs text-ink-400 italic">
            <span>GST</span>
            <span>Disabled (0%)</span>
          </div>
        )}

        {/* Editable Total Box */}
        <div className="mt-2 rounded-md bg-brand-700 p-2.5 text-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Total (Option 1)</span>
            {canOverrideMarkup ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-brand-200">₹</span>
                <input
                  type="number"
                  min={0}
                  className="h-8 w-32 rounded bg-brand-800 px-2 text-right text-base font-bold text-white border border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300 tabular-nums"
                  value={Math.round(q.total)}
                  onChange={(e) => handleCustomTotal(Number(e.target.value))}
                  title="Directly edit Total Price to auto-adjust Markup %"
                />
              </div>
            ) : (
              <span className="text-base font-bold tabular-nums">₹{inr(q.total)}</span>
            )}
          </div>
          {canOverrideMarkup && (
            <div className="mt-1 flex items-center justify-between text-[11px] text-brand-100">
              <span>Direct edit adjusts Markup %</span>
              <span>Markup: <b>{q.markupPct}%</b></span>
            </div>
          )}
        </div>
      </div>

      {q2 ? (
        <div className="rounded-lg border border-ocean-200 bg-ocean-50/40 p-2.5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ocean-700">
            Option 2 {cat(inputs.category2_id) ? `(${cat(inputs.category2_id)})` : ''}
          </p>
          {row('Hotels', q2.hotels)}
          {row(`Vehicle${q2.vehicle.days ? ` (${q2.vehicle.days} days)` : ''}`, q2.vehicle.total)}
          {q2.other > 0 && row('Other costs', q2.other)}
          {row('Net cost', q2.net, true)}
          {row(`Markup (${q2.markupPct}%)`, q2.markup)}
          {inputs.gst_enabled && q2.gstPct > 0 ? (
            row(`GST (${q2.gstPct}%)`, q2.gst)
          ) : (
            <div className="flex justify-between py-0.5 text-xs text-ocean-400 italic">
              <span>GST</span>
              <span>Disabled (0%)</span>
            </div>
          )}
          <div className="mt-2 rounded-md bg-ocean-800 p-2.5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Total (Option 2)</span>
              <span className="text-base font-bold tabular-nums">₹{inr(q2.total)}</span>
            </div>
            {canOverrideMarkup && (
              <div className="mt-1 flex items-center justify-between text-[11px] text-ocean-100">
                <span>Auto-calculated with {q2.markupPct}% markup</span>
                <span>Markup: <b>₹{inr(q2.markup)}</b></span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 p-2.5 text-center text-xs text-ink-400">
          <p className="font-medium text-ink-600">Single option quotation</p>
          <p className="mt-0.5 text-[11px]">Select a 2nd category in the form above if you want to quote 2 options side-by-side.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small UI bits
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-0.5 block truncate text-[11px] font-medium text-ink-700">{label}</label>
      {children}
      {hint && <p className="mt-0.5 truncate text-[10px] text-ink-400">{hint}</p>}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-md border border-ink-200 p-1.5 text-ink-500 disabled:opacity-30',
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-brand-50 hover:text-brand-700'
      )}
    >
      {children}
    </button>
  );
}
