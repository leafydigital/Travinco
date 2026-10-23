'use client';

import { useEffect, useRef } from 'react';

interface CodeEmbedProps {
  code: string;
  className?: string;
}

/**
 * Client component that inserts raw HTML/widget markup using `range.createContextualFragment`.
 *
 * In HTML5 specifications, script tags inserted via `innerHTML` or `dangerouslySetInnerHTML`
 * are intentionally not executed by the browser. By using `range.createContextualFragment()`,
 * any embedded `<script>` tags are properly parsed and executed within the live DOM.
 */
export function CodeEmbed({ code, className }: CodeEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Reset container contents
    el.innerHTML = '';

    if (!code || !code.trim()) return;

    try {
      const range = document.createRange();
      range.selectNode(el);
      const fragment = range.createContextualFragment(code);
      el.appendChild(fragment);
    } catch (err) {
      console.error('[CodeEmbed] Error inserting widget contextual fragment:', err);
    }

    return () => {
      if (el) el.innerHTML = '';
    };
  }, [code]);

  return <div ref={containerRef} className={className} />;
}
