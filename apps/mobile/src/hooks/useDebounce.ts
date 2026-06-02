import { useEffect, useState } from "react";

/**
 * Debounce any rapidly-changing value (e.g. search input). The returned
 * value updates `ms` milliseconds after the latest set. Cancellation on
 * unmount avoids a stale state update after the screen has been popped.
 */
export const useDebounce = <T,>(value: T, ms = 250): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};
