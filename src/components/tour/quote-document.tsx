/* eslint-disable @next/next/no-img-element */
import type { QuoteSnapshot } from '@/lib/tour/types';
import { fmtDay, inr } from '@/lib/tour/engine';

/**
 * Customer-facing quotation document (itinerary + pricing + terms).
 * Formatted precisely to match the official Travinco Kerala Tour Package design.
 */
const DARK_GREEN = '#0e4429';
const ACCENT_GREEN = '#165b40';
const LIGHT_HEAD = '#85b88f';

const cell: React.CSSProperties = {
  border: '1px solid #d1d5db',
  padding: '6px 8px',
  fontSize: 12,
  verticalAlign: 'middle',
};

const thStyle: React.CSSProperties = {
  ...cell,
  background: LIGHT_HEAD,
  color: '#0e4429',
  fontWeight: 700,
  textAlign: 'left',
};

function SectionHeader({ icon, title }: { icon?: string; title: string }) {
  return (
    <div
      style={{
        color: DARK_GREEN,
        borderBottom: `2px solid ${DARK_GREEN}`,
        paddingBottom: 4,
        marginTop: 22,
        marginBottom: 10,
        fontSize: 14.5,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span>{title}</span>
    </div>
  );
}

export function QuoteDocument({
  s,
  quoteNumber,
  logoUrl = '/brand/travinco-logo.png',
}: {
  s: QuoteSnapshot;
  quoteNumber?: string;
  logoUrl?: string;
  tourismLogoUrl?: string;
}) {
  const kv: [string, string][] = [
    ['Travel Dates', s.dates || 'TBC'],
    ['Duration', s.duration],
    ['Guests', s.guests_line || 'TBC'],
    ...(s.pickup ? ([['Arrival', s.pickup]] as [string, string][]) : []),
    ...(s.drop ? ([['Departure', s.drop]] as [string, string][]) : []),
    ['Transport', s.vehicle || 'Private A/C vehicle – all days'],
    ['Meal Plan', s.meal_plan || 'Daily Breakfast + Houseboat: Lunch, Dinner & Breakfast'],
  ];

  return (
    <article
      id="quote-doc"
      className="mx-auto max-w-[820px] bg-white px-6 py-8 text-[12.5px] leading-relaxed text-ink-800 sm:px-10 print:max-w-none print:px-0 print:py-0"
      style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
    >
      {/* Top Header Bar */}
      <header style={{ paddingBottom: 10, borderBottom: '1px solid #d1d5db', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <img
            src={logoUrl}
            alt={s.company?.name || 'Travinco'}
            style={{ height: 46, maxWidth: 220, objectFit: 'contain' }}
          />
          <div style={{ textAlign: 'right', fontSize: 12, color: '#4b5563', fontWeight: 500 }}>
            <span>{s.company?.phone || '+91-6235892269'}</span>
            <span style={{ margin: '0 6px' }}>|</span>
            <span>{s.company?.email || 'info@travinco.com'}</span>
          </div>
        </div>
      </header>

      {/* Title & Route Block */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          {/* Left: Tour Logo below header line */}
          <div style={{ width: 130, display: 'flex', justifyContent: 'flex-start' }}>
            <img
              src="/brand/Tour_logo.jpg"
              alt="Tourism Logo"
              style={{ height: 90, maxWidth: 130, objectFit: 'contain' }}
            />
          </div>

          {/* Center: Main Title */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: DARK_GREEN,
                letterSpacing: 0.5,
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              {s.doc_title || 'KERALA TOUR PACKAGE'}
            </h1>
            <div style={{ fontWeight: 700, fontSize: 14, color: ACCENT_GREEN, marginTop: 4 }}>{s.duration}</div>
            <div style={{ color: '#374151', fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{s.route.join(' • ')}</div>
            {quoteNumber && <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Quotation {quoteNumber}</div>}
          </div>

          {/* Right Spacer for balanced centering */}
          <div style={{ width: 130 }} />
        </div>
      </div>

      {/* Trip Overview */}
      <SectionHeader icon="📋" title="Trip Overview" />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {kv.map(([k, v]) => (
            <tr key={k}>
              <td style={{ ...cell, width: '28%', fontWeight: 700, color: DARK_GREEN, background: '#f8faf9' }}>
                {k}
              </td>
              <td style={cell}>{v}</td>
            </tr>
          ))}
          {s.options.map((o, idx) => (
            <tr key={o.label || idx}>
              <td style={{ ...cell, fontWeight: 700, color: '#14532d', background: '#eef7f1' }}>
                {o.label || 'Package Total'}
              </td>
              <td style={{ ...cell, fontWeight: 700, color: '#14532d', background: '#eef7f1' }}>
                Total INR {inr(o.total)} / Per person: INR {inr(o.per_person)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Package Summary */}
      <SectionHeader icon="🏨" title="Package Summary" />
      {s.options.map((o, i) => (
        <div key={o.label || i} style={{ marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  colSpan={5}
                  style={{
                    background: DARK_GREEN,
                    color: '#ffffff',
                    textAlign: 'center',
                    padding: '6px 8px',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                  }}
                >
                  {o.category || `Option ${i + 1}`}
                </th>
              </tr>
              <tr>
                <th style={{ ...thStyle, width: '32%' }}>Hotel Name</th>
                <th style={{ ...thStyle, width: '28%' }}>Room Type</th>
                <th style={{ ...thStyle, width: '16%' }}>Location</th>
                <th style={{ ...thStyle, width: '14%' }}>Date</th>
                <th style={{ ...thStyle, width: '10%' }}>Meal Plan</th>
              </tr>
            </thead>
            <tbody>
              {o.hotels.map((r, ix) => (
                <tr key={ix}>
                  <td style={{ ...cell, fontWeight: 600, color: '#1e3a8a' }}>{r[0]}</td>
                  <td style={{ ...cell, color: '#1e3a8a' }}>{r[1]}</td>
                  <td style={cell}>{r[2]}</td>
                  <td style={cell}>{r[3]}</td>
                  <td style={{ ...cell, textAlign: 'center', fontWeight: 600 }}>{r[4]}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...cell, fontWeight: 600 }}>Vehicle - A/C</td>
                <td style={cell}>{s.vehicle || 'Ertiga'}</td>
                <td style={{ ...cell, color: '#4b5563', fontSize: 11 }} colSpan={3}>
                  B - Breakfast, L - Lunch, D - Dinner
                </td>
              </tr>
              <tr>
                <td style={{ ...cell, fontWeight: 800, fontSize: 13, color: DARK_GREEN }} colSpan={2}>
                  Package Total
                </td>
                <td style={{ ...cell, fontWeight: 800, fontSize: 13, color: DARK_GREEN }} colSpan={3}>
                  ₹ {inr(o.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {/* Day-Wise Itinerary */}
      <SectionHeader icon="📅" title="Day-Wise Itinerary" />
      <p style={{ fontSize: 11, fontStyle: 'italic', color: '#b91c1c', marginBottom: 12 }}>
        Note: Hotels/resorts subject to availability; a similar category property will be provided if the listed hotel is unavailable. Munnar nights are cool (~14–18°C), so hill hotels are often non-A/C by design.
      </p>

      {s.days.map((d) => (
        <section
          key={d.n}
          style={{
            border: '1px solid #d5e6db',
            borderRadius: 6,
            marginBottom: 12,
            breakInside: 'avoid',
            overflow: 'hidden',
            background: '#ffffff',
          }}
        >
          {/* Day Header Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#eef7f2',
              borderBottom: '1px solid #d5e6db',
            }}
          >
            <div
              style={{
                background: DARK_GREEN,
                color: '#ffffff',
                fontWeight: 800,
                padding: '6px 14px',
                fontSize: 12.5,
                letterSpacing: 0.5,
                whiteSpace: 'nowrap',
              }}
            >
              DAY {d.n}
            </div>
            <div
              style={{
                color: DARK_GREEN,
                fontWeight: 700,
                padding: '6px 12px',
                fontSize: 12.5,
                flex: 1,
              }}
            >
              | {d.title}
            </div>
            {d.date && (
              <div style={{ color: '#4b5563', fontSize: 11, paddingRight: 12 }}>{fmtDay(d.date)}</div>
            )}
          </div>

          {/* Day Content */}
          <div style={{ padding: '10px 14px' }}>
            <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
              {d.lines.map((l, i) => (
                <li key={i} style={{ marginBottom: 4, lineHeight: 1.45 }}>
                  {l}
                </li>
              ))}
            </ul>

            {d.tip && (
              <div
                style={{
                  background: '#fefce8',
                  border: '1px solid #fef08a',
                  borderRadius: 4,
                  padding: '6px 10px',
                  fontSize: 11.5,
                  color: '#713f12',
                  margin: '8px 0 4px',
                }}
              >
                💡 {d.tip}
              </div>
            )}

            {d.note && (
              <div
                style={{
                  background: '#eef7f1',
                  border: '1px solid #bbf7d0',
                  borderRadius: 4,
                  padding: '6px 10px',
                  fontSize: 11.5,
                  color: '#14532d',
                  margin: '8px 0 4px',
                }}
              >
                {d.note}
              </div>
            )}

            {/* Day Footer Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                padding: '5px 12px',
                fontSize: 11.5,
                color: '#334155',
                marginTop: 8,
              }}
            >
              <span>🍽 {d.meals || 'Breakfast'}</span>
              <span>🏨 {d.stay || `${d.location || 'Hotel'} / Resort`}</span>
              <span>📍 {d.location || 'Kerala'}</span>
            </div>
          </div>
        </section>
      ))}

      <div style={{ textAlign: 'center', margin: '20px 0 16px', fontSize: 13, fontWeight: 700, color: DARK_GREEN }}>
        ✈ Trip Ends with Beautiful Memories of God&apos;s Own Country ✈
      </div>

      {/* Inclusions */}
      <SectionHeader icon="✅" title="Package Inclusions" />
      <ul style={{ paddingLeft: 18, listStyle: 'disc', margin: 0 }}>
        {s.inclusions.map((x, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            {x}
          </li>
        ))}
      </ul>

      {/* Exclusions */}
      {s.exclusions.length > 0 && (
        <>
          <SectionHeader icon="✖" title="Exclusions" />
          <ul style={{ paddingLeft: 18, listStyle: 'disc', margin: 0 }}>
            {s.exclusions.map((x, i) => (
              <li key={i} style={{ marginBottom: 3 }}>
                {x}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Optional Activities */}
      {s.optional.length > 0 && (
        <>
          <SectionHeader icon="🏄" title="Optional Activities (At Additional Cost)" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '45%' }}>Activity</th>
                <th style={{ ...thStyle, width: '25%' }}>Location</th>
                <th style={{ ...thStyle, width: '30%' }}>Approx. Cost/Unit</th>
              </tr>
            </thead>
            <tbody>
              {s.optional.map((r, i) => (
                <tr key={i}>
                  <td style={cell}>{r[0]}</td>
                  <td style={cell}>{r[1]}</td>
                  <td style={{ ...cell, fontWeight: 600 }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Cancellation Policy */}
      {s.cancellation.length > 0 && (
        <>
          <SectionHeader icon="📌" title="Cancellation Policy" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '60%' }}>Cancellation Timeline</th>
                <th style={{ ...thStyle, width: '40%' }}>Charge</th>
              </tr>
            </thead>
            <tbody>
              {s.cancellation.map((r, i) => (
                <tr key={i}>
                  <td style={cell}>{r[0]}</td>
                  <td style={{ ...cell, fontWeight: 600, color: r[1]?.includes('No Refund') || r[1]?.includes('100%') ? '#b91c1c' : 'inherit' }}>
                    {r[1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, fontStyle: 'italic', color: '#b91c1c', marginTop: 6, marginBottom: 0 }}>
            Note: No refund for missed sightseeing due to weather, road conditions, or government restrictions. Houseboat upgrades/downgrades subject to availability at time of booking.
          </p>
        </>
      )}

      {/* Important Notes */}
      {s.notes.length > 0 && (
        <>
          <SectionHeader icon="📝" title="Important Notes" />
          <ul style={{ paddingLeft: 18, listStyle: 'disc', margin: 0 }}>
            {s.notes.map((x, i) => (
              <li key={i} style={{ marginBottom: 3 }}>
                {x}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Call to Action Box */}
      <div style={{ textAlign: 'center', marginTop: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: DARK_GREEN }}>Book Your Dream Kerala Escape Today!</div>
        <div style={{ fontSize: 12.5, color: '#c2410c', fontWeight: 600, marginTop: 4 }}>
          📞 {s.company?.phone || '+91-6235892269'} &nbsp;|&nbsp; ✉ {s.company?.email || 'info@travinco.com'}
        </div>
      </div>

      {/* Trust & Partnership Footer (Exact PDF logos) */}
      <footer style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #d1d5db', breakInside: 'avoid' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          {/* Left: Registered with */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#374151', fontWeight: 700, marginBottom: 8 }}>Registered with</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <img src="/brand/msme_logo.jpg" alt="MSME" style={{ height: 38, maxWidth: 85, objectFit: 'contain' }} />
                <div style={{ fontSize: 9.5, color: '#4b5563', marginTop: 2, fontWeight: 600, whiteSpace: 'nowrap' }}>Kerala Toursim</div>
              </div>
              <img src="/brand/ktdc_logo.jpg" alt="KTDC" style={{ height: 40, maxWidth: 95, objectFit: 'contain' }} />
              <div style={{ fontSize: 9.5, color: '#4b5563', marginTop: 2, fontWeight: 600, whiteSpace: 'nowrap' }}>Reg: KL-12-0120111</div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div style={{ width: 1, height: 60, background: '#d1d5db' }} />

          {/* Right: Proud Booking Partners */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#374151', fontWeight: 700, marginBottom: 8 }}>Proud Booking partners of</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <img src="/brand/abad_logo.jpg" alt="ABAD Hotels" style={{ height: 40, maxWidth: 85, objectFit: 'contain' }} />
              <img src="/brand/cghearth_logo.jpg" alt="CGH Earth" style={{ height: 40, maxWidth: 110, objectFit: 'contain' }} />
              <img src="/brand/greenroutes_logo.jpg" alt="Green Routes" style={{ height: 40, maxWidth: 120, objectFit: 'contain' }} />
              <img src="/brand/green_router.jpg" alt="Green Router" style={{ height: 40, maxWidth: 110, objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      </footer>
    </article>
  );
}
