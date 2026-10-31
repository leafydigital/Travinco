'use client';

import { useEffect } from 'react';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Text-like inputs whose surrounding spaces are never meaningful. */
const TRIM_TYPES = new Set(['text', 'email', 'tel', 'search', 'url', '']);

/** Sets a field's value so React's onChange runs, as if the user had typed it. */
function setValueForReact(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // The prototype setter skips React's value tracker, so React sees the change
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (!setter) return;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ── Autofill ─────────────────────────────────────────────────────────── */

function isAutofilled(el: Element): boolean {
  for (const selector of [':autofill', ':-webkit-autofill']) {
    try {
      if (el.matches(selector)) return true;
    } catch {
      // Selector not supported by this browser
    }
  }
  return false;
}

const pushed = new WeakMap<Field, string>();

/**
 * Hands a browser-filled value to React. React only sees a change when the DOM
 * value differs from its internal tracker; values autofilled before hydration
 * already match the tracker, so onChange never fires and controlled state stays
 * empty (the field looks filled but validation says "required"). Resetting the
 * tracker and firing an input event makes React run onChange with the real value.
 */
function pushAutofillToReact(el: Field) {
  // Each autofilled value is handed over once, so onChange side effects don't repeat
  if (!el.value || pushed.get(el) === el.value) return;
  pushed.set(el, el.value);
  const tracker = (el as unknown as { _valueTracker?: { setValue(v: string): void } })._valueTracker;
  tracker?.setValue('');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  if (el instanceof HTMLSelectElement) el.dispatchEvent(new Event('change', { bubbles: true }));
}

function syncAutofilled(root: ParentNode = document) {
  root.querySelectorAll<Field>('input, textarea, select').forEach((el) => {
    if (isAutofilled(el)) pushAutofillToReact(el);
  });
}

/* ── Blank / padded text ──────────────────────────────────────────────── */

/**
 * On leaving a text field, drop surrounding spaces (a textarea only when it is
 * nothing but spaces). "   " then counts as empty for every required check, and
 * " name@x.com " is checked as typed. Opt out with data-no-trim.
 */
function trimOnBlur(el: EventTarget | null) {
  if (el instanceof HTMLInputElement) {
    if (!TRIM_TYPES.has(el.type) || el.readOnly || el.disabled) return;
    if (el.getAttribute('role') === 'combobox' || el.hasAttribute('data-no-trim')) return;
    const trimmed = el.value.trim();
    if (trimmed !== el.value) setValueForReact(el, trimmed);
  } else if (el instanceof HTMLTextAreaElement) {
    if (el.readOnly || el.disabled || el.hasAttribute('data-no-trim')) return;
    if (el.value && !el.value.trim()) setValueForReact(el, '');
  }
}

/** Native `required` accepts "   "; make the browser treat it as empty too. */
function flagBlankRequired(el: EventTarget | null) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  if (!el.required || (el instanceof HTMLInputElement && !TRIM_TYPES.has(el.type))) return;
  const blank = el.value.length > 0 && !el.value.trim();
  if (blank) {
    el.setCustomValidity('This field cannot be blank.');
    el.dataset.blankFlagged = '1';
  } else if (el.dataset.blankFlagged) {
    el.setCustomValidity('');
    delete el.dataset.blankFlagged;
  }
}

/* ── Number inputs ────────────────────────────────────────────────────── */

/**
 * Number fields never take exponents ("1e5") or a "+", take "-" only when their
 * min allows negatives, and take "." only when their step allows decimals.
 */
function guardNumberKey(e: KeyboardEvent) {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== 'number' || e.ctrlKey || e.metaKey) return;
  const min = el.min === '' ? 0 : Number(el.min);
  const integerOnly = el.step !== '' && el.step !== 'any' && Number.isInteger(Number(el.step));
  if (
    e.key === 'e' ||
    e.key === 'E' ||
    e.key === '+' ||
    (e.key === '-' && !(min < 0)) ||
    (e.key === '.' && integerOnly)
  ) {
    e.preventDefault();
  }
}

/** Scrolling the page over a focused number field must not change its value. */
function guardNumberWheel(e: WheelEvent) {
  const el = e.target;
  if (el instanceof HTMLInputElement && el.type === 'number' && document.activeElement === el) el.blur();
}

/**
 * Mounted once in the root layout. App-wide safety nets for every form:
 * browser autofill reaches React state, blank/padded text is trimmed, and
 * number fields reject characters they can never hold.
 */
export function FormGuards() {
  useEffect(() => {
    // Autofill that happened before hydration
    const timers = [0, 300, 1000].map((ms) => window.setTimeout(() => syncAutofilled(), ms));

    // Later autofill: the :-webkit-autofill rule in globals.css starts this animation
    const onAnimationStart = (e: AnimationEvent) => {
      if (e.animationName === 'tv-autofill-start' && e.target instanceof Element) {
        pushAutofillToReact(e.target as Field);
      }
    };

    // Chrome hides autofilled passwords from scripts until the first user
    // interaction, and they must be synced before any submit handler reads state.
    const onInteract = (e: Event) => {
      const form = e.target instanceof Element ? e.target.closest('form') : null;
      syncAutofilled(form ?? document);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      onInteract(e);
      guardNumberKey(e);
    };
    const onFocusOut = (e: FocusEvent) => {
      trimOnBlur(e.target);
      flagBlankRequired(e.target);
    };
    const onInput = (e: Event) => flagBlankRequired(e.target);

    document.addEventListener('animationstart', onAnimationStart, true);
    document.addEventListener('pointerdown', onInteract, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('submit', onInteract, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('wheel', guardNumberWheel, { capture: true, passive: true });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener('animationstart', onAnimationStart, true);
      document.removeEventListener('pointerdown', onInteract, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('submit', onInteract, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('wheel', guardNumberWheel, true);
    };
  }, []);

  return null;
}
