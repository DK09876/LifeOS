'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// --- Persistence helpers ---

export function usePersistedSet(key: string, defaultValue: Set<string>): [Set<string>, (v: Set<string>) => void] {
  const [value, setValue] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return defaultValue;
  });

  const setAndPersist = useCallback((v: Set<string>) => {
    setValue(v);
    localStorage.setItem(key, JSON.stringify(Array.from(v)));
  }, [key]);

  return [value, setAndPersist];
}

export function usePersistedSortLevels(key: string, defaultValue: SortLevel[]): [SortLevel[], (v: SortLevel[]) => void] {
  const [value, setValue] = useState<SortLevel[]>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch {}
    return defaultValue;
  });

  const setAndPersist = useCallback((v: SortLevel[]) => {
    setValue(v);
    localStorage.setItem(key, JSON.stringify(v));
  }, [key]);

  return [value, setAndPersist];
}

// --- Column Visibility ---

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

interface ColumnsPopoverProps {
  columns: ColumnDef[];
  visibleColumns: Set<string>;
  onChange: (visible: Set<string>) => void;
}

function Popover({ open, onClose, trigger, children }: {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      {trigger}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-[#252525] border border-[var(--border-color)] rounded-lg shadow-xl min-w-[240px]">
          {children}
        </div>
      )}
    </div>
  );
}

export function ColumnsButton({ columns, visibleColumns, onChange }: ColumnsPopoverProps) {
  const [open, setOpen] = useState(false);

  const toggle = (key: string) => {
    const next = new Set(visibleColumns);
    if (next.has(key)) {
      if (next.size <= 1) return; // keep at least one
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          Columns
        </button>
      }
    >
      <div className="p-3">
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Visible Columns</p>
        <div className="space-y-1">
          {columns.map(col => (
            <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--card-hover)] cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={visibleColumns.has(col.key)}
                onChange={() => toggle(col.key)}
                className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-white">{col.label}</span>
            </label>
          ))}
        </div>
      </div>
    </Popover>
  );
}

// --- Multi-level Sort ---

export interface SortLevel {
  field: string;
  direction: 'asc' | 'desc';
}

interface SortButtonProps {
  columns: { key: string; label: string }[];
  sortLevels: SortLevel[];
  onChange: (levels: SortLevel[]) => void;
}

export function SortButton({ columns, sortLevels, onChange }: SortButtonProps) {
  const [open, setOpen] = useState(false);

  const addLevel = () => {
    const used = new Set(sortLevels.map(s => s.field));
    const next = columns.find(c => !used.has(c.key));
    if (next) {
      onChange([...sortLevels, { field: next.key, direction: 'asc' }]);
    }
  };

  const removeLevel = (index: number) => {
    onChange(sortLevels.filter((_, i) => i !== index));
  };

  const updateField = (index: number, field: string) => {
    const next = [...sortLevels];
    next[index] = { ...next[index], field };
    onChange(next);
  };

  const toggleDirection = (index: number) => {
    const next = [...sortLevels];
    next[index] = { ...next[index], direction: next[index].direction === 'asc' ? 'desc' : 'asc' };
    onChange(next);
  };

  const usedFields = new Set(sortLevels.map(s => s.field));

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          Sort{sortLevels.length > 0 ? ` (${sortLevels.length})` : ''}
        </button>
      }
    >
      <div className="p-3">
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Sort By</p>
        {sortLevels.length === 0 && (
          <p className="text-sm text-[var(--muted)] mb-2">No sort applied</p>
        )}
        <div className="space-y-2">
          {sortLevels.map((level, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-xs text-[var(--muted)]">then</span>}
              <select
                value={level.field}
                onChange={(e) => updateField(index, e.target.value)}
                className="flex-1 px-2 py-1.5 bg-[var(--background)] border border-[var(--border-color)] rounded text-sm text-white"
              >
                {columns.map(col => (
                  <option key={col.key} value={col.key} disabled={usedFields.has(col.key) && col.key !== level.field}>
                    {col.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => toggleDirection(index)}
                className="px-2 py-1.5 bg-[var(--background)] border border-[var(--border-color)] rounded text-sm text-white hover:bg-[var(--card-hover)]"
                title={level.direction === 'asc' ? 'Ascending' : 'Descending'}
              >
                {level.direction === 'asc' ? '↑' : '↓'}
              </button>
              <button
                onClick={() => removeLevel(index)}
                className="px-1.5 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded text-sm"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {sortLevels.length < columns.length && (
          <button
            onClick={addLevel}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300"
          >
            + Add sort level
          </button>
        )}
      </div>
    </Popover>
  );
}

// --- Filters ---

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

// Filter values are now arrays to support multi-select
// Empty array or array with 'all' means no filter applied
export type FilterValues = Record<string, string[]>;

interface FilterButtonProps {
  filters: FilterDef[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

export function usePersistedFilters(key: string, defaultValue: FilterValues): [FilterValues, (v: FilterValues) => void] {
  const [value, setValue] = useState<FilterValues>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migration: convert old string values to arrays
        const migrated: FilterValues = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (Array.isArray(v)) {
            migrated[k] = v;
          } else if (typeof v === 'string') {
            migrated[k] = v === 'all' ? [] : [v];
          } else {
            migrated[k] = [];
          }
        }
        return migrated;
      }
    } catch {}
    return defaultValue;
  });

  const setAndPersist = useCallback((v: FilterValues) => {
    setValue(v);
    localStorage.setItem(key, JSON.stringify(v));
  }, [key]);

  return [value, setAndPersist];
}

// Helper to check if a filter is active (has selections other than 'all')
export function isFilterActive(values: string[]): boolean {
  return values.length > 0 && !(values.length === 1 && values[0] === 'all');
}

// Helper to check if a value matches the filter
export function matchesFilter(filterValues: string[], itemValue: string): boolean {
  // No filter or 'all' selected = matches everything
  if (filterValues.length === 0 || (filterValues.length === 1 && filterValues[0] === 'all')) {
    return true;
  }
  return filterValues.includes(itemValue);
}

export function FilterButton({ filters, values, onChange }: FilterButtonProps) {
  const [open, setOpen] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const activeCount = Object.entries(values).filter(([_, v]) => isFilterActive(v)).length;

  const handleToggle = (filterKey: string, optionValue: string) => {
    const current = values[filterKey] || [];

    // If toggling 'all', clear all other selections
    if (optionValue === 'all') {
      onChange({ ...values, [filterKey]: [] });
      return;
    }

    // Remove 'all' from the list if it's there
    let newValues = current.filter(v => v !== 'all');

    if (newValues.includes(optionValue)) {
      // Remove the value
      newValues = newValues.filter(v => v !== optionValue);
    } else {
      // Add the value
      newValues = [...newValues, optionValue];
    }

    // If all specific options are selected, or none are, treat as 'all'
    const allOptions = filters.find(f => f.key === filterKey)?.options.filter(o => o.value !== 'all') || [];
    if (newValues.length === 0 || newValues.length === allOptions.length) {
      newValues = [];
    }

    onChange({ ...values, [filterKey]: newValues });
  };

  const handleClear = () => {
    const cleared: FilterValues = {};
    for (const f of filters) {
      cleared[f.key] = [];
    }
    onChange(cleared);
  };

  const isChecked = (filterKey: string, optionValue: string) => {
    const current = values[filterKey] || [];
    if (optionValue === 'all') {
      return current.length === 0 || (current.length === 1 && current[0] === 'all');
    }
    return current.includes(optionValue);
  };

  const getFilterSummary = (filterKey: string) => {
    const current = values[filterKey] || [];
    if (!isFilterActive(current)) return 'All';
    if (current.length === 1) {
      const filter = filters.find(f => f.key === filterKey);
      const option = filter?.options.find(o => o.value === current[0]);
      return option?.label || current[0];
    }
    return `${current.length} selected`;
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          onClick={() => setOpen(!open)}
          className={`px-3 py-2 bg-[var(--card-bg)] border rounded text-sm transition-colors ${
            activeCount > 0
              ? 'border-blue-500 text-blue-400'
              : 'border-[var(--border-color)] text-[var(--muted)] hover:text-white'
          }`}
        >
          Filter{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      }
    >
      <div className="p-3 max-h-[400px] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Filters</p>
          {activeCount > 0 && (
            <button onClick={handleClear} className="text-xs text-blue-400 hover:text-blue-300">
              Clear all
            </button>
          )}
        </div>
        <div className="space-y-1">
          {filters.map(filter => {
            const isExpanded = expandedFilter === filter.key;
            const hasActiveFilter = isFilterActive(values[filter.key] || []);

            return (
              <div key={filter.key} className="border border-[var(--border-color)] rounded">
                <button
                  onClick={() => setExpandedFilter(isExpanded ? null : filter.key)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[var(--card-hover)] rounded"
                >
                  <span className="text-sm text-white">{filter.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${hasActiveFilter ? 'text-blue-400' : 'text-[var(--muted)]'}`}>
                      {getFilterSummary(filter.key)}
                    </span>
                    <span className="text-[var(--muted)]">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-0.5">
                    {filter.options.map(opt => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--card-hover)] cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked(filter.key, opt.value)}
                          onChange={() => handleToggle(filter.key, opt.value)}
                          className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--background)] text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-white">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Popover>
  );
}

// --- Multi-level sort comparator helper ---

export function multiLevelSort<T>(
  items: T[],
  sortLevels: SortLevel[],
  comparators: Record<string, (a: T, b: T) => number>,
): T[] {
  if (sortLevels.length === 0) return items;

  return [...items].sort((a, b) => {
    for (const level of sortLevels) {
      const cmp = comparators[level.field];
      if (!cmp) continue;
      const result = cmp(a, b);
      if (result !== 0) {
        return level.direction === 'asc' ? result : -result;
      }
    }
    return 0;
  });
}
