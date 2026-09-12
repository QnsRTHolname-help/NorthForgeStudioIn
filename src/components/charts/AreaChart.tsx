import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { CHART_COLORS, ChartTable, niceTicks, shortNumber, useChartSize, type Series } from './primitives';

/**
 * Responsive area/line chart.
 *
 * Hand-rolled SVG: no chart library, full control over the visual language,
 * and a screen-reader data table is always rendered alongside (spec §142).
 */
export function AreaChart({
  labels,
  series,
  height = 240,
  caption,
  showGrid = true,
  className,
  formatValue,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  caption: string;
  showGrid?: boolean;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  const { ref, width } = useChartSize<HTMLDivElement>();
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const padding = { top: 12, right: 8, bottom: 26, left: 38 };
  const innerWidth = Math.max(0, width - padding.left - padding.right);
  const innerHeight = Math.max(0, height - padding.top - padding.bottom);

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max, 4);
  const tickMax = ticks[ticks.length - 1] ?? max;

  const xFor = (index: number) =>
    labels.length <= 1 ? padding.left + innerWidth / 2 : padding.left + (index / (labels.length - 1)) * innerWidth;
  const yFor = (value: number) => padding.top + innerHeight - (value / tickMax) * innerHeight;

  const paths = useMemo(
    () =>
      series.map((s) => {
        const points = s.values.map((value, index) => `${xFor(index).toFixed(2)},${yFor(value).toFixed(2)}`);
        const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point}`).join(' ');
        const area = `${line} L${xFor(s.values.length - 1).toFixed(2)},${(padding.top + innerHeight).toFixed(2)} L${xFor(0).toFixed(2)},${(padding.top + innerHeight).toFixed(2)} Z`;
        return { ...s, line, area };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, height, tickMax],
  );

  const resolveColor = (color: string) => CHART_COLORS[color as keyof typeof CHART_COLORS] ?? color;

  // Label density: never let x-axis labels collide (spec §142).
  const step = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(innerWidth / 70))));

  return (
    <div className={cn('w-full', className)}>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={caption}
            className="overflow-visible"
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              {series.map((s, index) => (
                <linearGradient key={s.key} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={resolveColor(s.color)} stopOpacity="0.26" />
                  <stop offset="100%" stopColor={resolveColor(s.color)} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            {showGrid
              ? ticks.map((tick) => (
                  <g key={tick}>
                    <line
                      x1={padding.left}
                      x2={padding.left + innerWidth}
                      y1={yFor(tick)}
                      y2={yFor(tick)}
                      stroke="rgb(var(--nf-line))"
                      strokeWidth="1"
                      strokeDasharray={tick === 0 ? undefined : '3 4'}
                    />
                    <text
                      x={padding.left - 8}
                      y={yFor(tick) + 3}
                      textAnchor="end"
                      className="nf-num fill-[rgb(var(--nf-faint))] text-[10px]"
                    >
                      {formatValue ? formatValue(tick) : shortNumber(tick)}
                    </text>
                  </g>
                ))
              : null}

            {paths.map((s, index) => (
              <g key={s.key}>
                <path d={s.area} fill={`url(#${gradientId}-${index})`} />
                <path
                  d={s.line}
                  fill="none"
                  stroke={resolveColor(s.color)}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))}

            {labels.map((label, index) =>
              index % step === 0 ? (
                <text
                  key={`${label}-${index}`}
                  x={xFor(index)}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-[rgb(var(--nf-faint))] text-[10px]"
                >
                  {label}
                </text>
              ) : null,
            )}

            {hover !== null ? (
              <g>
                <line
                  x1={xFor(hover)}
                  x2={xFor(hover)}
                  y1={padding.top}
                  y2={padding.top + innerHeight}
                  stroke="rgb(var(--nf-line-strong))"
                  strokeWidth="1"
                />
                {series.map((s) => (
                  <circle
                    key={s.key}
                    cx={xFor(hover)}
                    cy={yFor(s.values[hover] ?? 0)}
                    r="3.5"
                    fill="rgb(var(--nf-surface))"
                    stroke={resolveColor(s.color)}
                    strokeWidth="2"
                  />
                ))}
              </g>
            ) : null}

            {/* Invisible hover targets, one per data point. */}
            {labels.map((_, index) => (
              <rect
                key={`hit-${index}`}
                x={xFor(index) - innerWidth / labels.length / 2}
                y={padding.top}
                width={innerWidth / labels.length}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
              />
            ))}
          </svg>
        ) : null}

        {hover !== null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[130px] -translate-x-1/2 rounded border border-line bg-elevated px-2.5 py-1.5 text-xs shadow-lift"
            style={{ left: xFor(hover), top: 4 }}
          >
            <p className="mb-1 font-medium text-fg">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: resolveColor(s.color) }} aria-hidden />
                  {s.label}
                </span>
                <span className="nf-num text-fg">{formatValue ? formatValue(s.values[hover] ?? 0) : (s.values[hover] ?? 0)}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {series.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-4">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: resolveColor(s.color) }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}

      <ChartTable caption={caption} labels={labels} series={series} />
    </div>
  );
}
