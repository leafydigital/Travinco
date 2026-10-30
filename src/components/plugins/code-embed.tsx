'use client';

import { useEffect, useId, useRef } from 'react';

interface CodeEmbedProps {
  code: string;
  className?: string;
}

declare global {
  interface Window {
    __tvPluginRan?: Record<string, true>;
  }
}

/**
 * Renders raw HTML/widget markup.
 *
 * The markup is part of the server-rendered HTML, so widgets appear together with
 * the page and their <script> tags run while the browser parses it (no wait for
 * hydration). A tiny marker script records that this embed's scripts already ran.
 *
 * After a client-side navigation the same markup is inserted by React via innerHTML,
 * where browsers do NOT execute <script> tags. In that case the marker is missing
 * (client-rendered ids differ from server ids), so the effect re-creates each script
 * element to execute it.
 */
export function CodeEmbed({ code, className }: CodeEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const embedId = useId();
  const markerKey = JSON.stringify(embedId);
  const html = code?.trim()
    ? `<script>(window.__tvPluginRan=window.__tvPluginRan||{})[${markerKey}]=true</script>${code}`
    : '';

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !html) return;
    if (window.__tvPluginRan?.[embedId]) return; // ran during the initial page load

    el.querySelectorAll('script').forEach((oldScript) => {
      try {
        const script = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
        script.text = oldScript.text;
        oldScript.replaceWith(script);
      } catch (err) {
        console.error('[CodeEmbed] Error executing widget script:', err);
      }
    });
  }, [html, embedId]);

  return (
    <div
      ref={containerRef}
      className={className}
      // Third-party widget scripts may rewrite their own markup before hydration
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
