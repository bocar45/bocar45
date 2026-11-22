"use client";

import { useCallback, useRef, useState } from "react";

/** State with undo/redo. `preview` changes the present without recording (live drag); `commit` records. */
export function useHistory<T>(initial: T, limit = 100) {
  const [state, setState] = useState({ past: [] as T[], present: initial, future: [] as T[] });
  const anchor = useRef<T | null>(null);

  const commit = useCallback((next: T | ((cur: T) => T)) => {
    setState((s) => {
      const value = typeof next === "function" ? (next as (cur: T) => T)(s.present) : next;
      const base = anchor.current ?? s.present;
      anchor.current = null;
      if (Object.is(value, base)) return { ...s, present: value };
      return { past: [...s.past, base].slice(-limit), present: value, future: [] };
    });
  }, [limit]);

  const preview = useCallback((next: (cur: T) => T) => {
    setState((s) => {
      if (anchor.current === null) anchor.current = s.present;
      return { ...s, present: next(s.present) };
    });
  }, []);

  const undo = useCallback(() => setState((s) => {
    const prev = s.past.at(-1);
    if (prev === undefined) return s;
    return { past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future] };
  }), []);

  const redo = useCallback(() => setState((s) => {
    const next = s.future[0];
    if (next === undefined) return s;
    return { past: [...s.past, s.present], present: next, future: s.future.slice(1) };
  }), []);

  /** Update the present without touching history (derived data such as measured text size). */
  const silent = useCallback((next: (cur: T) => T) => setState((s) => ({ ...s, present: next(s.present) })), []);

  const reset = useCallback((value: T) => setState({ past: [], present: value, future: [] }), []);

  return { value: state.present, commit, preview, silent, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
