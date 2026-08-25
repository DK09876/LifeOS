/**
 * Drop-in replacement for dexie-react-hooks' useLiveQuery.
 *
 * Same signature, so the call sites in hooks.ts were unchanged: run the
 * query, re-run whenever the store changes. Dexie observed IndexedDB
 * directly; here the store notifies after every server write.
 */

'use client';

import { useEffect, useState } from 'react';

import { subscribe } from './store';

export function useLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: unknown[] = [],
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await querier();
        if (!cancelled) setValue(result);
      } catch (error) {
        if (!cancelled) console.error('[live-query] failed', error);
      }
    };

    run();
    const unsubscribe = subscribe(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
