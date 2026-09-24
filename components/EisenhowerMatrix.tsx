'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { Task } from '@/types';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/dates';

const IMPORTANCE_CUT = 45;
const URGENCY_CUT = 65;
const URGENCY_MAX = 120;
const IMPORTANCE_MIN = 15;
const IMPORTANCE_MAX = 65;
const URGENCY_MIN = 10;

interface EisenhowerMatrixProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onPlan?: (task: Task) => void;
}

type QuadrantKey = 'doNow' | 'schedule' | 'fitIn' | 'backburner';

/**
 * The classic layout: important on top, urgent on the left. Colour follows
 * the quadrant (what kind of work it is), not the score - the position
 * already says how high the score is, and a second colour scale for the same
 * thing was only noise.
 */
const QUADRANTS: Array<{ key: QuadrantKey; label: string; hint: string; action: string; text: string; border: string; fill: string; dot: string }> = [
  { key: 'doNow', label: 'Do Now', hint: 'Important · urgent', action: 'Do these first.', text: 'text-red-300', border: 'border-red-500/40', fill: 'rgba(239,68,68,0.10)', dot: '#f87171' },
  { key: 'schedule', label: 'Schedule', hint: 'Important · not urgent', action: 'Put them on a day before they become urgent.', text: 'text-purple-300', border: 'border-purple-500/40', fill: 'rgba(139,92,246,0.10)', dot: '#a78bfa' },
  { key: 'fitIn', label: 'Fit In', hint: 'Urgent · less important', action: 'Keep them quick, batch them.', text: 'text-amber-300', border: 'border-amber-500/40', fill: 'rgba(245,158,11,0.10)', dot: '#fbbf24' },
  { key: 'backburner', label: 'Backburner', hint: 'Neither, for now', action: 'Fine to leave. Archive what will never happen.', text: 'text-slate-300', border: 'border-slate-500/40', fill: 'rgba(100,116,139,0.08)', dot: '#94a3b8' },
];

function quadrantOf(task: Task): QuadrantKey {
  const important = task.importanceScore >= IMPORTANCE_CUT;
  const urgent = task.urgencyScore >= URGENCY_CUT;
  if (important && urgent) return 'doNow';
  if (important) return 'schedule';
  if (urgent) return 'fitIn';
  return 'backburner';
}

const VIEW_KEY = 'matrix-view';

interface DataPoint {
  x: number;
  y: number;
  tasks: Task[];
  size: number;
  color: string;
  label: string;
  /** Whether there is room to name it on the chart without colliding. */
  showLabel: boolean;
}

// Custom dot renderer
function RenderDot(props: { cx?: number; cy?: number; payload?: DataPoint }) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  const isMultiple = payload.tasks.length > 1;
  const r = payload.size;

  return (
    <g className="matrix-dot">
      {/* Invisible larger hit area for easier clicking */}
      <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
      {/* Hover ring — hidden by default, shown on hover via CSS */}
      <circle
        className="matrix-dot-ring"
        cx={cx}
        cy={cy}
        r={r + 4}
        fill="none"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={2}
        opacity={0}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={payload.color}
        fillOpacity={0.9}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1.5}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
      />
      {!isMultiple && payload.showLabel && (
        <text x={cx + r + 5} y={cy} dominantBaseline="central" fill="var(--foreground)" fontSize={11} opacity={0.85} pointerEvents="none">
          {payload.label}
        </text>
      )}
      {isMultiple && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={r > 14 ? 12 : 10}
          fontWeight={700}
          pointerEvents="none"
        >
          {payload.tasks.length}
        </text>
      )}
    </g>
  );
}

// Quadrant label component
function QuadrantLabel({ viewBox, label, color }: { viewBox?: { x: number; y: number; width: number; height: number }; label: string; color: string }) {
  if (!viewBox) return null;
  return (
    <text
      x={viewBox.x + 10}
      y={viewBox.y + 18}
      textAnchor="start"
      fill={color}
      fontSize={12}
      fontWeight={600}
    >
      {label}
    </text>
  );
}

export default function EisenhowerMatrix({ tasks, onTaskClick, onPlan }: EisenhowerMatrixProps) {
  const [view, setView] = useState<'lists' | 'chart'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'chart' ? 'chart' : 'lists'; } catch { return 'lists'; }
  });
  const chooseView = (next: 'lists' | 'chart') => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* not persisted */ }
  };

  // Filter to active tasks only
  const activeTasks = useMemo(() => tasks.filter(t =>
    t.status !== 'Done' && t.status !== 'Archived' && t.status !== 'Needs Details' && t.status !== 'Blocked',
  ), [tasks]);

  const byQuadrant = useMemo(() => {
    const out: Record<QuadrantKey, Task[]> = { doNow: [], schedule: [], fitIn: [], backburner: [] };
    for (const task of activeTasks) out[quadrantOf(task)].push(task);
    for (const list of Object.values(out)) list.sort((a, b) => b.taskScore - a.taskScore);
    return out;
  }, [activeTasks]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs text-[var(--muted)]">{activeTasks.length} active task{activeTasks.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-1 bg-[var(--card-bg)] rounded-lg p-1">
          {(['lists', 'chart'] as const).map(v => (
            <button key={v} onClick={() => chooseView(v)}
                    className={`px-3 py-1 rounded text-sm ${view === v ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:text-white'}`}>
              {v === 'lists' ? 'Lists' : 'Chart'}
            </button>
          ))}
        </div>
      </div>

      {view === 'lists' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {QUADRANTS.map(q => (
            <section key={q.key} className={`bg-[var(--card-bg)] rounded-lg border ${q.border} flex flex-col`}>
              <header className="px-4 pt-3 pb-2 border-b border-[var(--border-color)]">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className={`font-medium ${q.text}`}>{q.label}</h3>
                  <span className="text-sm text-white font-semibold">{byQuadrant[q.key].length}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">{q.hint} — {q.action}</p>
              </header>
              {byQuadrant[q.key].length === 0 ? (
                <p className="px-4 py-4 text-sm text-[var(--muted)]">Nothing here.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-color)] md:max-h-80 md:overflow-y-auto">
                  {byQuadrant[q.key].map(task => (
                    <li key={task.id} className="flex items-center gap-2 px-4 py-2.5">
                      <button onClick={() => onTaskClick(task)} className="flex-1 min-w-0 text-left">
                        <span className="block text-sm text-white truncate">{task.taskName}</span>
                        <span className="block text-xs text-[var(--muted)] truncate">
                          {task.domain?.icon ? `${task.domain.icon} ` : ''}
                          {task.plannedDate ? `Planned ${format(parseLocalDate(task.plannedDate), 'EEE d MMM')}` : 'Unplanned'}
                          {task.dueDate ? ` · due ${format(parseLocalDate(task.dueDate), 'EEE d MMM')}` : ''}
                          {' · '}score {task.taskScore}
                        </span>
                      </button>
                      {onPlan && (
                        <button onClick={() => onPlan(task)}
                                className="flex-shrink-0 px-2 py-1 rounded text-xs text-blue-300 bg-blue-500/10 hover:bg-blue-500/20">
                          📅 Plan
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : (
        <MatrixChart tasks={activeTasks} onTaskClick={onTaskClick} />
      )}
    </div>
  );
}

function MatrixChart({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (task: Task) => void }) {
  const [pinnedData, setPinnedData] = useState<{ data: DataPoint; x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  // Cluster tasks that land on the same spot, so they read as a count
  // rather than one dot hiding another.
  const chartData = useMemo((): DataPoint[] => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = `${Math.round(task.urgencyScore / 4) * 4},${Math.round(task.importanceScore / 3) * 3}`;
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    const colour = Object.fromEntries(QUADRANTS.map(q => [q.key, q.dot]));
    const points = Array.from(map.entries()).map(([key, group]) => {
      const [x, y] = key.split(',').map(Number);
      const name = group[0].taskName;
      return {
        x: Math.min(URGENCY_MAX, Math.max(URGENCY_MIN, x)),
        y: Math.min(IMPORTANCE_MAX, Math.max(IMPORTANCE_MIN, y)),
        tasks: group,
        size: group.length > 1 ? 10 + Math.min(group.length, 8) * 1.5 : 7,
        color: colour[quadrantOf(group[0])],
        label: name.length > 16 ? `${name.slice(0, 15)}…` : name,
        showLabel: false,
      };
    });
    // Name a dot only where the name has room: nothing to its right on the
    // same line for a good stretch. Crowded dots are read by tapping, or in
    // the list view - overlapping names were unreadable anyway.
    for (const point of points) {
      point.showLabel = point.tasks.length === 1 && point.x <= URGENCY_MAX - 30 && !points.some(other =>
        other !== point && Math.abs(other.y - point.y) < 5 && other.x >= point.x - 4 && other.x - point.x < 34);
    }
    return points;
  }, [tasks]);

  useEffect(() => {
    if (!pinnedData) return;
    function handleClickOutside(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setPinnedData(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pinnedData]);

  const handleDotClick = useCallback((data: DataPoint, _index: number, e: React.MouseEvent) => {
    const wrapper = chartWrapperRef.current;
    if (!wrapper) return;
    if (data.tasks.length === 1) { onTaskClick(data.tasks[0]); return; }
    const rect = wrapper.getBoundingClientRect();
    // Positioned here, where the wrapper can be measured, rather than while rendering.
    const x = Math.max(8, Math.min(e.clientX - rect.left + 12, rect.width - 248));
    setPinnedData({ data, x, y: Math.max(e.clientY - rect.top - 20, 8) });
  }, [onTaskClick]);

  const [lowQ, highQ] = [QUADRANTS[3], QUADRANTS[0]];
  return (
    <div>
      <style>{`
        .recharts-surface:focus, .recharts-surface *:focus { outline: none; }
        .recharts-reference-area rect { stroke: none !important; }
        .matrix-dot { cursor: pointer; }
        .matrix-dot:hover .matrix-dot-ring { opacity: 1 !important; }
      `}</style>
      <div ref={chartWrapperRef} className="bg-[var(--card-bg)] rounded-lg p-2 md:p-4 relative">
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
            {/* Four quadrants filling the whole plot, so where a task sits
                reads at a glance. Urgent is on the right. */}
            <ReferenceArea x1={URGENCY_CUT} x2={URGENCY_MAX} y1={IMPORTANCE_CUT} y2={IMPORTANCE_MAX} fill={QUADRANTS[0].fill} fillOpacity={1}>
              <Label content={<QuadrantLabel label="Do Now" color={QUADRANTS[0].dot} />} />
            </ReferenceArea>
            <ReferenceArea x1={URGENCY_MIN} x2={URGENCY_CUT} y1={IMPORTANCE_CUT} y2={IMPORTANCE_MAX} fill={QUADRANTS[1].fill} fillOpacity={1}>
              <Label content={<QuadrantLabel label="Schedule" color={QUADRANTS[1].dot} />} />
            </ReferenceArea>
            <ReferenceArea x1={URGENCY_CUT} x2={URGENCY_MAX} y1={IMPORTANCE_MIN} y2={IMPORTANCE_CUT} fill={QUADRANTS[2].fill} fillOpacity={1}>
              <Label content={<QuadrantLabel label="Fit In" color={QUADRANTS[2].dot} />} />
            </ReferenceArea>
            <ReferenceArea x1={URGENCY_MIN} x2={URGENCY_CUT} y1={IMPORTANCE_MIN} y2={IMPORTANCE_CUT} fill={lowQ.fill} fillOpacity={1}>
              <Label content={<QuadrantLabel label="Backburner" color={lowQ.dot} />} />
            </ReferenceArea>

            <XAxis type="number" dataKey="x" domain={[URGENCY_MIN, URGENCY_MAX]} ticks={[URGENCY_MIN, URGENCY_CUT, URGENCY_MAX]}
                   tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false}>
              <Label value="More urgent →" position="bottom" offset={10} style={{ fill: 'var(--muted)', fontSize: 12 }} />
            </XAxis>
            <YAxis type="number" dataKey="y" domain={[IMPORTANCE_MIN - 2, IMPORTANCE_MAX + 3]} ticks={[IMPORTANCE_MIN, IMPORTANCE_CUT, IMPORTANCE_MAX]}
                   tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} width={30} />
            <Tooltip content={() => null} cursor={false} />
            <Scatter data={chartData} shape={<RenderDot />} onClick={handleDotClick} cursor="pointer" />
          </ScatterChart>
        </ResponsiveContainer>

        {pinnedData && (
          <div
            ref={tooltipRef}
            className="absolute z-20 bg-[var(--background)] border border-[var(--border-color)] rounded-lg shadow-xl w-60"
            style={{ left: pinnedData.x, top: pinnedData.y }}
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-[var(--border-color)]">
              <span className="text-[10px] text-[var(--muted)]">{pinnedData.data.tasks.length} tasks here</span>
              <button onClick={() => setPinnedData(null)} className="text-[var(--muted)] hover:text-white text-xs ml-4" aria-label="Close">✕</button>
            </div>
            <div className="p-2 space-y-0.5 max-h-56 overflow-y-auto">
              {pinnedData.data.tasks.map(task => (
                <button key={task.id} onClick={() => { setPinnedData(null); onTaskClick(task); }}
                        className="block w-full text-left px-2 py-1.5 rounded hover:bg-[var(--card-bg)] transition-colors">
                  <span className="text-sm text-white block truncate">{task.taskName}</span>
                  <span className="text-[10px] text-[var(--muted)]">Importance {task.importanceScore} · urgency {task.urgencyScore}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Up is more important, right is more urgent — {highQ.label} is top right. Tap a dot to open it; a number means several tasks in one spot.
      </p>
    </div>
  );
}
