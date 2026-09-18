"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * A ref that always holds the most recent committed value.
 *
 * Long-lived async work (a streaming fetch, an rAF loop, a speech queue) needs to read
 * current props without re-subscribing every render. Writing the ref during render is not
 * allowed under the React Compiler rules, so the sync happens on commit instead.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
