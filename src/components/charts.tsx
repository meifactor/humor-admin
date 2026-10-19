"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Chart conventions (from the dataviz guidelines): bars <= 24px with a 4px rounded top and a
// square baseline, 2px surface-colored gaps between stacked segments, hairline gridlines,
// labels in text colors (never the series color), and a hover tooltip on every column.

const GRID = "#34342f";
const INK_3 = "#8f8e85";
const HEIGHT = 220;
const MARGIN = { top: 12, right: 8, bottom: 26, left: 36 };
const MAX_BAR = 24;

export type Series = { key: string; label: string; color: string };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

// Round the axis maximum up to a clean number with 4 even ticks.
function niceTicks(max: number) {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const nice = Math.max(1, step);
  return [0, 1, 2, 3, 4].map((i) => Math.round(i * nice * 100) / 100);
}

// A bar with a 4px rounded top and square bottom.
function barPath(x: number, y: number, width: number, height: number, rounded: boolean) {
  const r = rounded ? Math.min(4, width / 2, height) : 0;
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

type ColumnChartProps = {
  data: Record<string, number | string>[];
  // Key for the x-axis category (e.g. "day" or "hour").
  xKey: string;
  // One entry = simple columns; several = stacked in this order (bottom first).
  series: Series[];
  formatX: (value: number | string) => string;
  // Show every nth x label so they don't collide.
  labelEvery?: number;
  ariaLabel: string;
};

export function ColumnChart({ data, xKey, series, formatX, labelEvery = 1, ariaLabel }: ColumnChartProps) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const totals = data.map((d) => series.reduce((sum, s) => sum + Number(d[s.key] ?? 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const yMax = ticks[ticks.length - 1] || 1;

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.max(2, Math.min(MAX_BAR, band * 0.7));
  const y = (value: number) => MARGIN.top + plotHeight - (value / yMax) * plotHeight;

  let tooltip: ReactNode = null;
  if (hover !== null && data[hover]) {
    const d = data[hover];
    const left = MARGIN.left + band * hover + band / 2;
    tooltip = (
      <div
        role="status"
        className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 rounded-md border border-edge bg-black px-3 py-2 text-xs shadow-xl"
        style={{ left: Math.min(Math.max(left, 80), width - 80), top: 0 }}
      >
        <p className="mb-1 font-bold text-white">{formatX(d[xKey])}</p>
        {[...series].reverse().map((s) => (
          <p key={s.key} className="flex items-center justify-between gap-3 text-ink-2">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-bold text-white tabular-nums">{Number(d[s.key] ?? 0)}</span>
          </p>
        ))}
        {series.length > 1 && (
          <p className="mt-1 flex justify-between border-t border-edge pt-1 text-ink-2">
            Total <span className="font-bold text-white tabular-nums">{totals[hover]}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
              <text x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK_3}>
                {tick.toLocaleString()}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = MARGIN.left + band * i + (band - barWidth) / 2;
            const visible = series.filter((s) => Number(d[s.key] ?? 0) > 0);
            let base = 0;
            return (
              <g key={String(d[xKey])} opacity={hover === null || hover === i ? 1 : 0.45}>
                {visible.map((s, segment) => {
                  const value = Number(d[s.key]);
                  const top = y(base + value);
                  const bottom = y(base);
                  base += value;
                  // 2px surface gap between stacked segments.
                  const height = Math.max(0, bottom - top - (segment > 0 ? 2 : 0));
                  return (
                    <path
                      key={s.key}
                      d={barPath(x, top, barWidth, height, segment === visible.length - 1)}
                      fill={s.color}
                    />
                  );
                })}
                {i % labelEvery === 0 && (
                  <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={INK_3}>
                    {formatX(d[xKey])}
                  </text>
                )}
                {/* Hover target: the whole column band, larger than the bar itself. */}
                <rect
                  x={MARGIN.left + band * i}
                  y={MARGIN.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {tooltip}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-03" -> "Oct 3" (parsed by hand so the server and browser time zones don't shift it).
export function formatDay(value: number | string) {
  const [, month, day] = String(value).split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

// 0 -> "12a", 13 -> "1p"
export function formatHour(value: number | string) {
  const hour = Number(value);
  return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`;
}

export function DailyReactionsChart({ data, series }: { data: Record<string, number | string>[]; series: Series[] }) {
  return (
    <ColumnChart
      data={data}
      xKey="day"
      series={series}
      formatX={formatDay}
      labelEvery={5}
      ariaLabel="Reactions per day for the last 30 days, stacked by reaction"
    />
  );
}

export function HourlyChart({
  data,
  metric,
  label,
  color,
}: {
  data: Record<string, number | string>[];
  metric: string;
  label: string;
  color: string;
}) {
  return (
    <ColumnChart
      data={data}
      xKey="hour"
      series={[{ key: metric, label, color }]}
      formatX={formatHour}
      labelEvery={3}
      ariaLabel={`${label} by hour of day, New York time`}
    />
  );
}
