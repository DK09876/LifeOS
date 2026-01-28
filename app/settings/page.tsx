'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [hideGetStarted, setHideGetStarted] = useState(false);

  useEffect(() => {
    setHideGetStarted(localStorage.getItem('hideGetStarted') === 'true');
  }, []);

  const handleToggle = () => {
    const next = !hideGetStarted;
    setHideGetStarted(next);
    localStorage.setItem('hideGetStarted', String(next));
    // Dispatch storage event so sidebar picks it up
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Settings</h1>
        <p className="text-[var(--muted)]">Configure LifeOS preferences</p>
      </div>

      <div className="bg-[var(--card-bg)] rounded-lg p-5">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-white font-medium">Hide "Get Started" page</p>
            <p className="text-sm text-[var(--muted)]">Remove the Get Started link from the sidebar</p>
          </div>
          <input
            type="checkbox"
            checked={hideGetStarted}
            onChange={handleToggle}
            className="w-5 h-5 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
