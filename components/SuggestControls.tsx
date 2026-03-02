'use client';

import { SuggestControls as SuggestControlsType, DEFAULT_SUGGEST_CONTROLS } from '@/lib/suggest';
import { Domain } from '@/types';

interface SuggestControlsProps {
  controls: SuggestControlsType;
  onChange: (controls: SuggestControlsType) => void;
  domains: Domain[];
}

export default function SuggestControls({ controls, onChange, domains }: SuggestControlsProps) {
  const update = (partial: Partial<SuggestControlsType>) => {
    onChange({ ...controls, ...partial });
  };

  const weightSum = controls.scoreWeight + controls.deadlineWeight + controls.balanceWeight + controls.efficiencyWeight;

  return (
    <div className="space-y-5">
      {/* AP Settings */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Capacity</h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-[var(--muted)]">Daily AP Budget</label>
              <span className="text-sm text-white font-medium">{controls.dailyAPBudget}</span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={controls.dailyAPBudget}
              onChange={(e) => update({ dailyAPBudget: parseInt(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-[var(--muted)]">
              <span>1</span>
              <span>15</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-[var(--muted)]">Default AP (for tasks with none set)</label>
              <span className="text-sm text-white font-medium">{controls.defaultAP}</span>
            </div>
            <select
              value={controls.defaultAP}
              onChange={(e) => update({ defaultAP: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded text-sm text-white"
            >
              <option value={1}>1 AP</option>
              <option value={2}>2 AP</option>
              <option value={3}>3 AP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Domain Focus */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Domain Focus</h3>
        <div className="space-y-1">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--card-hover)] cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={controls.domainFocus.length === 0}
              onChange={() => update({ domainFocus: [] })}
              className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-white">All Domains</span>
          </label>
          {domains.map(d => (
            <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--card-hover)] cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={controls.domainFocus.includes(d.id)}
                onChange={() => {
                  const next = controls.domainFocus.includes(d.id)
                    ? controls.domainFocus.filter(id => id !== d.id)
                    : [...controls.domainFocus, d.id];
                  update({ domainFocus: next });
                }}
                className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-white">{d.icon || '📁'} {d.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Weights */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-white">Scoring Weights</h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">Adjust these to change how suggestions are ranked</p>
          </div>
          {Math.abs(weightSum - 1.0) > 0.01 && (
            <span className="text-xs text-yellow-400">
              Sum: {weightSum.toFixed(2)} (auto-normalized)
            </span>
          )}
        </div>
        <div className="space-y-3">
          {([
            { key: 'scoreWeight' as const, label: 'Base Score', description: 'Task importance x urgency' },
            { key: 'deadlineWeight' as const, label: 'Deadline Pressure', description: 'Prioritize approaching due dates' },
            { key: 'balanceWeight' as const, label: 'Domain Balance', description: 'Diversify across domains' },
            { key: 'efficiencyWeight' as const, label: 'Effort Match', description: 'Fit tasks to remaining capacity' },
          ] as const).map(({ key, label, description }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <label className="text-sm text-[var(--muted)]">{label}</label>
                  <p className="text-xs text-[var(--muted)] opacity-60">{description}</p>
                </div>
                <span className="text-sm text-white font-medium">{controls[key].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={controls[key]}
                onChange={(e) => update({ [key]: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => onChange(DEFAULT_SUGGEST_CONTROLS)}
        className="w-full px-4 py-2 text-sm text-[var(--muted)] hover:text-white bg-[var(--background)] hover:bg-[var(--card-hover)] border border-[var(--border-color)] rounded transition-colors"
      >
        Reset to Defaults
      </button>
    </div>
  );
}
