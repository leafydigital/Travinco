/**
 * Original travel-themed loading animation: a simple road with a car
 * icon that drives across it on a loop, plus dashed lane markings that
 * scroll to suggest motion. Pure SVG/CSS, no external assets.
 */
export function TravelLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 py-16">
      <div className="relative h-24 w-64 overflow-hidden">
        {/* sky/horizon strip */}
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-ocean-50 to-transparent" />

        {/* road */}
        <div className="absolute inset-x-0 bottom-6 h-8 rounded-full bg-ink-700">
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="road-dashes absolute inset-y-0 flex items-center gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="h-1 w-6 shrink-0 rounded-full bg-white/70" />
              ))}
            </div>
          </div>
        </div>

        {/* car, driving left to right on a loop */}
        <div className="car-drive absolute bottom-6">
          <svg
            width="56"
            height="28"
            viewBox="0 0 56 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect x="4" y="12" width="44" height="10" rx="4" fill="var(--loader-car-body, #0f766e)" />
            <path
              d="M12 12 L18 4 H38 L44 12 Z"
              fill="var(--loader-car-body, #0f766e)"
            />
            <path d="M20 10 L23 6 H35 L38 10 Z" fill="#e0f2fe" opacity="0.9" />
            <circle cx="15" cy="22" r="5" fill="#1e293b" />
            <circle cx="15" cy="22" r="2" fill="#94a3b8" />
            <circle cx="41" cy="22" r="5" fill="#1e293b" />
            <circle cx="41" cy="22" r="2" fill="#94a3b8" />
          </svg>
        </div>
      </div>

      <p className="text-sm font-medium text-ink-500">{label}</p>

      <style>{`
        @keyframes travel-loader-drive {
          0% { transform: translateX(-64px); }
          100% { transform: translateX(256px); }
        }
        @keyframes travel-loader-road {
          0% { transform: translateX(0); }
          100% { transform: translateX(-48px); }
        }
        .car-drive {
          animation: travel-loader-drive 1.6s linear infinite;
        }
        .road-dashes {
          animation: travel-loader-road 0.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
