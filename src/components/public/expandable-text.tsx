'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableTextProps {
  text: string | null | undefined;
  collapsedLines?: number;
  characterThreshold?: number;
  className?: string;
  readMoreLabel?: string;
  readLessLabel?: string;
}

export function ExpandableText({
  text,
  collapsedLines = 4,
  characterThreshold = 250,
  className = '',
  readMoreLabel = 'Read more',
  readLessLabel = 'Show less',
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text || !text.trim()) return null;

  const trimmed = text.trim();
  const lineCount = (trimmed.match(/\n/g) || []).length + 1;
  const shouldTruncate = trimmed.length > characterThreshold || lineCount > collapsedLines;

  if (!shouldTruncate) {
    return <p className={`whitespace-pre-line text-ink-600 ${className}`}>{trimmed}</p>;
  }

  return (
    <div className="space-y-2.5">
      <div
        className={`whitespace-pre-line text-ink-600 transition-all ${className}`}
        style={
          isExpanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: collapsedLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {trimmed}
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded py-0.5 group"
      >
        <span>{isExpanded ? readLessLabel : readMoreLabel}</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 text-brand-600" />
        ) : (
          <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5 text-brand-600" />
        )}
      </button>
    </div>
  );
}
