import { useEffect, useRef, useState } from 'react';

/** Measures a container so SVG charts can be fully responsive (spec §142). */
export function useChartSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

export function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const step = (normalised >= 5 ? 10 : normalised >= 2 ? 5 : normalised >= 1 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.5; value += step) ticks.push(Math.round(value * 100) / 100);
  return ticks;
}

export const CHART_COLORS = {
  primary: 'rgb(var(--nf-blue))',
  violet: 'rgb(var(--nf-violet))',
  success: 'rgb(var(--nf-success))',
  warning: 'rgb(var(--nf-warning))',
  danger: 'rgb(var(--nf-danger))',
  muted: 'rgb(var(--nf-faint))',
};

/** Compact number formatting for axis labels. */
export function shortNumber(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

export interface Series {
  key: string;
  label: string;
  color: keyof typeof CHART_COLORS | string;
  values: number[];
}

/** Screen-reader summary so charts are never image-only (spec §142). */
export function ChartTable({ caption, labels, series }: { caption: string; labels: string[]; series: Series[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Point</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, index) => (
          <tr key={`${label}-${index}`}>
            <th scope="row">{label}</th>
            {series.map((s) => (
              <td key={s.key}>{s.values[index] ?? 0}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
