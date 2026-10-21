'use client';

import { useEffect, useRef, useState } from 'react';

interface ExperienceStat {
  value: string;
  label: string;
}

interface AnimatedStatProps {
  value: string;
  label: string;
}

function parseStatValue(raw: string) {
  // Matches optional prefix (like $ or #), numeric digits with optional commas and decimals, and suffix (like +, %, ★, /7)
  const match = raw.trim().match(/^([^\d.]*)(\d[\d,]*\.?\d*)(.*)$/);
  if (!match) {
    return { prefix: '', target: null, suffix: raw, decimals: 0, hasComma: false };
  }

  const prefix = match[1] || '';
  const numStr = match[2] || '';
  const suffix = match[3] || '';

  const hasComma = numStr.includes(',');
  const cleanNumStr = numStr.replace(/,/g, '');
  const target = parseFloat(cleanNumStr);

  const decimalParts = cleanNumStr.split('.');
  const decimals = decimalParts.length > 1 ? decimalParts[1]!.length : 0;

  return {
    prefix,
    target: isNaN(target) ? null : target,
    suffix,
    decimals,
    hasComma,
  };
}

export function AnimatedStat({ value, label }: AnimatedStatProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState<string>(value);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const parsed = parseStatValue(value);
    if (parsed.target === null) {
      setDisplayValue(value);
      return;
    }

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();

          const target = parsed.target!;
          // If large target like 5000, start from 1. If smaller target like 4.9, start from 0
          const startVal = target >= 100 ? 1 : 0;
          const duration = 2000; // 2 seconds
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic curve: 1 - (1 - progress)^3
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentVal = startVal + (target - startVal) * easeOut;

            let formatted = '';
            if (parsed.decimals > 0) {
              formatted = currentVal.toFixed(parsed.decimals);
            } else {
              const rounded = Math.round(currentVal);
              formatted = parsed.hasComma
                ? rounded.toLocaleString('en-US')
                : rounded.toString();
            }

            setDisplayValue(`${parsed.prefix}${formatted}${parsed.suffix}`);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              // Exact final target formatting
              const finalFormatted =
                parsed.decimals > 0
                  ? target.toFixed(parsed.decimals)
                  : parsed.hasComma
                  ? Math.round(target).toLocaleString('en-US')
                  : Math.round(target).toString();
              setDisplayValue(`${parsed.prefix}${finalFormatted}${parsed.suffix}`);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [value]);

  return (
    <div ref={containerRef} className="flex flex-col items-center">
      <p className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-sand-300 tracking-tight transition-all tabular-nums">
        {displayValue}
      </p>
      <p className="mt-2 text-xs sm:text-sm text-white/70 font-medium max-w-[160px] leading-snug">
        {label}
      </p>
    </div>
  );
}

export function ExperienceStats({ stats }: { stats: ExperienceStat[] }) {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="mt-16 border-t border-white/10 pt-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
      {stats.map((stat, idx) => (
        <AnimatedStat key={`${stat.label}-${idx}`} value={stat.value} label={stat.label} />
      ))}
    </div>
  );
}
