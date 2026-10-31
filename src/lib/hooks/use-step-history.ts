'use client';

import { useEffect, useRef } from 'react';

type StepHistoryState = { travincoStepKey?: string; travincoStepIdx?: number };

/**
 * Ties a multi-step form (details → OTP → …) to the browser history, so the
 * browser's Back arrow goes to the previous step instead of leaving the page.
 *
 * Keep using `setStep` as before; this hook watches `step`:
 * - moving forward to a new step adds a history entry for the same URL,
 * - moving to the step before (an in-page "Back" button) pops that entry,
 * - jumping back to the first step (e.g. "Back to sign in") pops every entry,
 * - the browser's Back/Forward arrows set the matching step.
 *
 * `key` keeps two forms on the same page from reading each other's entries.
 */
export function useStepHistory<S extends string>(key: string, step: S, setStep: (s: S) => void, initialStep: S) {
  // Steps of this page's history entries; index 0 is the page's own entry
  const stack = useRef<S[]>([initialStep]);
  const fromPopState = useRef(false);
  const setStepRef = useRef(setStep);
  setStepRef.current = setStep;
  const currentStep = useRef(step);
  currentStep.current = step;

  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const state = e.state as StepHistoryState | null;
      const idx = state?.travincoStepKey === key ? state.travincoStepIdx ?? 0 : 0;
      const target = stack.current[idx] ?? initialStep;
      stack.current = stack.current.slice(0, idx + 1);
      if (target === currentStep.current) return;
      fromPopState.current = true;
      setStepRef.current(target);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [key, initialStep]);

  useEffect(() => {
    const s = stack.current;
    if (fromPopState.current) {
      fromPopState.current = false;
      return;
    }
    if (s[s.length - 1] === step) return;

    // Already in the history behind us (in-page Back, or "start over"): go back to it
    const earlier = s.lastIndexOf(step);
    if (earlier !== -1) {
      const steps = s.length - 1 - earlier;
      stack.current = s.slice(0, earlier + 1);
      // The popstate that follows lands on the step we're already showing
      window.history.go(-steps);
      return;
    }

    // A new step: add an entry for the same URL
    s.push(step);
    window.history.pushState(
      { ...(window.history.state ?? {}), travincoStepKey: key, travincoStepIdx: s.length - 1 },
      '',
      window.location.href
    );
  }, [key, step]);
}
