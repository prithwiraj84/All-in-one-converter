"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Saved values over the defaults, one level deep — so fields added to the
 *  defaults later still get a value when an older session is restored. */
function mergeSaved<T extends object>(initial: T, saved: unknown): T {
  if (!isPlainObject(saved)) return initial;
  const out = { ...initial } as Record<string, unknown>;
  for (const [k, v] of Object.entries(saved)) {
    const base = out[k];
    out[k] = isPlainObject(base) && isPlainObject(v) ? { ...base, ...v } : v;
  }
  return out as T;
}

/**
 * useState that persists to sessionStorage, so a form survives the OAuth
 * sign-in redirect. Renders with `initial` first (no hydration mismatch), then
 * restores the saved value. Storage failures (private mode, quota) are ignored.
 */
export function useSessionState<T extends object>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const restored = useRef(false);
  const initialRef = useRef(initial);

  // Declared before the restore effect, and skipped while the value is still the
  // untouched defaults, so it never overwrites the saved value (even when Strict
  // Mode runs the effects twice).
  useEffect(() => {
    if (!restored.current || value === initialRef.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable or full */
    }
  }, [key, value]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) setValue(mergeSaved(initialRef.current, JSON.parse(raw)));
    } catch {
      /* unreadable — keep the defaults */
    }
    restored.current = true;
  }, [key]);

  return [value, setValue];
}
