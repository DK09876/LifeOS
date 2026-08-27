'use client';

/**
 * Last-resort boundary. Data now comes from the Pi over HTTP, so a render
 * can fail for reasons that never applied when everything was local: the
 * server is down, Tailscale dropped, the response was malformed.
 */

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[lifeos] render failed', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)]">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-medium text-[var(--foreground)] mb-2">
          Something broke
        </h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md text-sm bg-[var(--card-bg)]
                       text-[var(--foreground)] border border-[var(--border-color)]
                       hover:bg-[var(--card-hover)] transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-md text-sm text-[var(--muted)]
                       hover:text-[var(--foreground)] transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
