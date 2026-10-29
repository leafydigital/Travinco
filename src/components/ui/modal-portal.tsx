'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a modal into <body> so its `fixed inset-0` backdrop always covers the whole
 * viewport (including the sidebar), whatever transforms or stacking contexts wrap it.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [target] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : document.body));
  return target ? createPortal(children, target) : null;
}
