import { useId } from 'react';
import { cn } from '@/lib/cn';
import { CHART_COLORS, ChartTable, niceTicks, shortNumber, useChartSize, type Series } from './primitives';

/* ── Bar chart ─────────────────────────────────────────────────── */

export function BarChart({
  labels,
  series,
  height = 220,
  caption,
  horizontal,
  className,
  formatValue,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  caption: string;
  horizontal?: boolean;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  const { ref, width } = useChartSize<HTMLDivElement>();
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max, 3);
  const tickMax = ticks[ticks.length - 1] ?? max;
  const resolveColor = (color: string) => CHART_COLORS[color as keyof typeof CHART_COLORS] ?? color;

  if (horizontal) {
    return (
      <div className={cn('w-full', className)} ref={ref}>
        <ul className="space-y-2.5">
          {labels.map((label, index) => {
            const value = series[0]?.values[index] ?? 0;
            const pct = (value / tickMax) * 100;
            return (
              <li key={`${label}-${index}`} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs text-muted" title={label}>
                  {label}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width] duration-700 ease-forge"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </span>
                <span className="nf-num w-12 shrink-0 text-right text-xs text-fg">
                  {formatValue ? formatValue(value) : value}
                </span>
              </li>
            );
          })}
        </ul>
        <ChartTable caption={caption} labels={labels} series={series} />
      </div>
    );
  }

  const padding = { top: 10, right: 8, bottom: 24, left: 34 };
  const innerWidth = Math.max(0, width - padding.left - padding.right);
  const innerHeight = Math.max(0, height - padding.top - padding.bottom);
  const slot = labels.length ? innerWidth / labels.length : 0;
  const barWidth = Math.max(3, Math.min(38, slot * 0.55));

  return (
    <div className={cn('w-full', className)} ref={ref}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={caption}>
          {ticks.map((tick) => {
            const y = padding.top + innerHeight - (tick / tickMax) * innerHeight;
            return (
              <g key={tick}>
                <line x1={padding.left} x2={padding.left + innerWidth} y1={y} y2={y} stroke="rgb(var(--nf-line))" strokeDasharray="3 4" />
                <text x={padding.left - 7} y={y + 3} textAnchor="end" className="nf-num fill-[rgb(var(--nf-faint))] text-[10px]">
                  {formatValue ? formatValue(tick) : shortNumber(tick)}
                </text>
              </g>
            );
          })}
          {labels.map((label, index) => {
            const value = series[0]?.values[index] ?? 0;
            const barHeight = Math.max(1, (value / tickMax) * innerHeight);
            const x = padding.left + index * slot + (slot - barWidth) / 2;
            const y = padding.top + innerHeight - barHeight;
            return (
              <g key={`${label}-${index}`}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx="3" fill={resolveColor(series[0]?.color ?? 'primary')} opacity="0.9">
                  <title>{`${label}: ${value}`}</title>
                </rect>
                {index % Math.ceil(labels.length / 8) === 0 ? (
                  <text
                    x={padding.left + index * slot + slot / 2}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-[rgb(var(--nf-faint))] text-[10px]"
                  >
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      <ChartTable caption={caption} labels={labels} series={series} />
    </div>
  );
}

/* ── Sparkline (KPI tiles) ─────────────────────────────────────── */

export function Sparkline({
  values,
  width = 96,
  height = 28,
  color = 'primary',
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: keyof typeof CHART_COLORS | string;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - ((value - min) / range) * height).toFixed(1)}`);
  const line = `M${points.join(' L')}`;
  const resolveColor = CHART_COLORS[color as keyof typeof CHART_COLORS] ?? color;

  return (
    <svg width={width} height={height} className={cn('overflow-visible', className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={resolveColor} stopOpacity="0.24" />
          <stop offset="100%" stopColor={resolveColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={resolveColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Donut ─────────────────────────────────────────────────────── */

export function DonutChart({
  segments,
  size = 148,
  thickness = 14,
  caption,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: keyof typeof CHART_COLORS | string }[];
  size?: number;
  thickness?: number;
  caption: string;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={caption} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--nf-sunken))" strokeWidth={thickness} />
          {total > 0
            ? segments.map((segment) => {
                const fraction = segment.value / total;
                const dash = fraction * circumference;
                const element = (
                  <circle
                    key={segment.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={CHART_COLORS[segment.color as keyof typeof CHART_COLORS] ?? segment.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                  />
                );
                offset += dash;
                return element;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="nf-num text-xl font-semibold text-fg">{centerValue ?? total}</span>
          {centerLabel ? <span className="text-2xs uppercase tracking-wider text-faint">{centerLabel}</span> : null}
        </div>
      </div>

      <ul className="min-w-[130px] space-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 text-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CHART_COLORS[segment.color as keyof typeof CHART_COLORS] ?? segment.color }}
                aria-hidden
              />
              {segment.label}
            </span>
            <span className="nf-num text-fg">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Funnel ────────────────────────────────────────────────────── */

export function Funnel({
  steps,
  className,
}: {
  steps: { key: string; label: string; value: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const colors = ['primary', 'violet', 'success', 'warning', 'danger'];

  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((step, index) => {
        const pct = (step.value / max) * 100;
        const prev = steps[index - 1];
        const drop = prev && prev.value > 0 ? Math.round(((prev.value - step.value) / prev.value) * 100) : null;
        return (
          <div key={step.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-fg">{step.label}</span>
              <span className="nf-num text-xs text-muted">
                {step.value.toLocaleString('en-IN')}
                {drop !== null && index > 0 ? <span className="ml-2 text-faint">−{drop}%</span> : null}
              </span>
            </div>
            <div className="h-8 w-full overflow-hidden rounded bg-sunken">
              <div
                className="flex h-full items-center justify-end rounded pr-2 transition-[width] duration-700 ease-forge"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: `${CHART_COLORS[colors[index % colors.length] as keyof typeof CHART_COLORS]}22`,
                  borderRight: `2px solid ${CHART_COLORS[colors[index % colors.length] as keyof typeof CHART_COLORS]}`,
                }}
              >
                <span
                  className="nf-num text-[11px] font-medium"
                  style={{ color: CHART_COLORS[colors[index % colors.length] as keyof typeof CHART_COLORS] }}
                >
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
