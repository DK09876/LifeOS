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

interface EisenhowerMatrixProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

interface DataPoint {
  x: number;
  y: number;
  tasks: Task[];
  avgScore: number;
  size: number;
}

// Score → color gradient (green→yellow→red)
function getScoreColor(combinedScore: number): string {
  const t = Math.min(1, Math.max(0, (combinedScore - 2) / 60));
  if (t < 0.5) {
    const r = Math.round(74 + (220 - 74) * (t * 2));
    const g = Math.round(222 + (200 - 222) * (t * 2));
    const b = Math.round(128 + (20 - 128) * (t * 2));
    return `rgb(${r},${g},${b})`;
  }
  const r = Math.round(220 + (239 - 220) * ((t - 0.5) * 2));
  const g = Math.round(200 - 150 * ((t - 0.5) * 2));
  const b = Math.round(20 + (60 - 20) * ((t - 0.5) * 2));
  return `rgb(${r},${g},${b})`;
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
        fill={getScoreColor(payload.avgScore)}
        fillOpacity={0.9}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1.5}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
      />
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
      x={viewBox.x + viewBox.width / 2}
      y={viewBox.y + 24}
      textAnchor="middle"
      fill={color}
      fontSize={14}
      fontWeight={600}
      opacity={0.6}
    >
      {label}
    </text>
  );
}

export default function EisenhowerMatrix({ tasks, onTaskClick }: EisenhowerMatrixProps) {
  const [pinnedData, setPinnedData] = useState<{ data: DataPoint; x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  // Filter to active tasks only
  const activeTasks = useMemo(() => {
    return tasks.filter(t =>
      t.status !== 'Done' &&
      t.status !== 'Archived' &&
      t.status !== 'Needs Details' &&
      t.status !== 'Blocked'
    );
  }, [tasks]);

  // Cluster tasks by rounding scores to 5-point buckets
  const chartData = useMemo((): DataPoint[] => {
    const map = new Map<string, Task[]>();
    for (const task of activeTasks) {
      const bucketX = Math.round(task.urgencyScore / 5) * 5;
      const bucketY = Math.round(task.importanceScore / 5) * 5;
      const key = `${bucketX},${bucketY}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries()).map(([key, tasks]) => {
      const [bx, by] = key.split(',').map(Number);
      const avgScore = tasks.reduce((s, t) => s + t.taskScore, 0) / tasks.length;
      return {
        x: bx,
        y: by,
        tasks,
        avgScore,
        size: tasks.length > 1 ? 10 + Math.min(tasks.length, 8) * 2 : 8,
      };
    });
  }, [activeTasks]);

  // Click outside to close pinned tooltip
  useEffect(() => {
    if (!pinnedData) return;
    function handleClickOutside(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setPinnedData(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pinnedData]);

  const handleDotClick = useCallback((data: DataPoint, _index: number, e: React.MouseEvent) => {
    const wrapper = chartWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPinnedData({ data, x, y });
  }, []);

  // Quadrant counts
  const quadrantCounts = useMemo(() => {
    const counts = { doNow: 0, schedule: 0, fitIn: 0, backburner: 0 };
    for (const task of activeTasks) {
      const highImportance = task.importanceScore >= 50;
      const highUrgency = task.urgencyScore >= 55;
      if (highImportance && highUrgency) counts.doNow++;
      else if (highImportance) counts.schedule++;
      else if (highUrgency) counts.fitIn++;
      else counts.backburner++;
    }
    return counts;
  }, [activeTasks]);

  return (
    <div>
      {/* Quadrant summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <p className="text-red-400 text-sm font-medium">Do Now</p>
          <p className="text-white text-2xl font-bold">{quadrantCounts.doNow}</p>
          <p className="text-[var(--muted)] text-[10px]">Important + Urgent</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
          <p className="text-purple-400 text-sm font-medium">Schedule</p>
          <p className="text-white text-2xl font-bold">{quadrantCounts.schedule}</p>
          <p className="text-[var(--muted)] text-[10px]">Important + Not Urgent</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
          <p className="text-amber-400 text-sm font-medium">Fit In</p>
          <p className="text-white text-2xl font-bold">{quadrantCounts.fitIn}</p>
          <p className="text-[var(--muted)] text-[10px]">Not Important + Urgent</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg p-3 text-center">
          <p className="text-slate-400 text-sm font-medium">Backburner</p>
          <p className="text-white text-2xl font-bold">{quadrantCounts.backburner}</p>
          <p className="text-[var(--muted)] text-[10px]">Not Important + Not Urgent</p>
        </div>
      </div>

      {/* Chart */}
      {/* Suppress Recharts focus outlines */}
      <style>{`
        .recharts-surface:focus, .recharts-surface *:focus { outline: none; }
        .recharts-reference-area rect { stroke: none !important; }
        .matrix-dot { cursor: pointer; transition: transform 0.15s ease; }
        .matrix-dot:hover .matrix-dot-ring { opacity: 1 !important; }
        .matrix-dot:hover { transform-origin: center; }
      `}</style>
      <div ref={chartWrapperRef} className="bg-[var(--card-bg)] rounded-lg p-4 relative">
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
            {/* Quadrant backgrounds */}
            {/* Do Now: top-right (red) */}
            <ReferenceArea
              x1={55} x2={100} y1={50} y2={80}
              fill="rgba(239,68,68,0.12)"
              fillOpacity={1}
              stroke="none"
              strokeOpacity={0}
            >
              <Label content={<QuadrantLabel label="Do Now" color="rgba(239,68,68,0.6)" />} />
            </ReferenceArea>
            {/* Schedule: top-left (purple) */}
            <ReferenceArea
              x1={10} x2={55} y1={50} y2={80}
              fill="rgba(139,92,246,0.10)"
              fillOpacity={1}
              stroke="none"
              strokeOpacity={0}
            >
              <Label content={<QuadrantLabel label="Schedule" color="rgba(139,92,246,0.6)" />} />
            </ReferenceArea>
            {/* Fit In: bottom-right (amber) */}
            <ReferenceArea
              x1={55} x2={100} y1={20} y2={50}
              fill="rgba(245,158,11,0.10)"
              fillOpacity={1}
              stroke="none"
              strokeOpacity={0}
            >
              <Label content={<QuadrantLabel label="Fit In" color="rgba(245,158,11,0.6)" />} />
            </ReferenceArea>
            {/* Backburner: bottom-left (slate) */}
            <ReferenceArea
              x1={10} x2={55} y1={20} y2={50}
              fill="rgba(100,116,139,0.08)"
              fillOpacity={1}
              stroke="none"
              strokeOpacity={0}
            >
              <Label content={<QuadrantLabel label="Backburner" color="rgba(100,116,139,0.45)" />} />
            </ReferenceArea>

            <XAxis
              type="number"
              dataKey="x"
              domain={[10, 100]}
              ticks={[10, 25, 40, 55, 70, 85, 100]}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={{ stroke: 'var(--border-color)' }}
            >
              <Label
                value="Urgency Score →"
                position="bottom"
                offset={10}
                style={{ fill: 'var(--muted)', fontSize: 12 }}
              />
            </XAxis>

            <YAxis
              type="number"
              dataKey="y"
              domain={[20, 80]}
              ticks={[20, 30, 40, 50, 60, 70, 80]}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={{ stroke: 'var(--border-color)' }}
            >
              <Label
                value="Importance Score →"
                angle={-90}
                position="left"
                offset={0}
                style={{ fill: 'var(--muted)', fontSize: 12, textAnchor: 'middle' }}
              />
            </YAxis>

            {/* Invisible tooltip — we handle display ourselves */}
            <Tooltip content={() => null} cursor={false} />

            <Scatter
              data={chartData}
              shape={<RenderDot />}
              onClick={handleDotClick}
              cursor="pointer"
            />
          </ScatterChart>
        </ResponsiveContainer>

        {/* Pinned tooltip — stays open until you click outside or dismiss */}
        {pinnedData && (
          <div
            ref={tooltipRef}
            className="absolute z-20 bg-[var(--background)] border border-[var(--border-color)] rounded-lg shadow-xl max-w-xs"
            style={{
              left: Math.min(pinnedData.x + 12, (chartWrapperRef.current?.offsetWidth ?? 500) - 260),
              top: Math.max(pinnedData.y - 20, 8),
            }}
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-[var(--border-color)]">
              <span className="text-[10px] text-[var(--muted)]">
                {pinnedData.data.tasks.length} task{pinnedData.data.tasks.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setPinnedData(null)}
                className="text-[var(--muted)] hover:text-white text-xs ml-4"
              >
                ✕
              </button>
            </div>
            <div className="p-2 space-y-0.5 max-h-56 overflow-y-auto">
              {pinnedData.data.tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => { setPinnedData(null); onTaskClick(task); }}
                  className="block w-full text-left px-2 py-1.5 rounded hover:bg-[var(--card-bg)] transition-colors"
                >
                  <span className="text-sm text-white block truncate">{task.taskName}</span>
                  <span className="text-[10px] text-[var(--muted)]">
                    Imp: {task.importanceScore} | Urg: {task.urgencyScore} | Score: {task.taskScore}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 text-xs text-[var(--muted)]">
        <span>{activeTasks.length} active task{activeTasks.length !== 1 ? 's' : ''} plotted</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: getScoreColor(5) }}></span>
            Low score
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: getScoreColor(30) }}></span>
            Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: getScoreColor(60) }}></span>
            High score
          </span>
        </div>
      </div>
    </div>
  );
}
