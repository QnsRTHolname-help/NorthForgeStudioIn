import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '@/components/motion';
import { useReducedMotion } from '@/hooks';
import { cn } from '@/lib/cn';

/**
 * The NorthForge Growth System.
 *
 * One connected loop — website → lead → AI → WhatsApp → automation →
 * analytics → customer → back to the website. It is drawn as a single SVG so
 * it scales from 320px to 4K without any layout maths, and so the connection
 * lines can actually be drawn in rather than faked with CSS.
 *
 * Motion contract:
 *   · connectors draw once, in order, when the composition enters view
 *   · nodes fade and settle in sequence behind them
 *   · one light "packet" travels the loop continuously — the only ambient
 *     movement, and it stops entirely under prefers-reduced-motion
 */

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: 'start' | 'ai' | 'end';
}

const NODES: Node[] = [
  { id: 'channel', label: 'Website / WhatsApp', x: 74, y: 62, kind: 'start' },
  { id: 'enquiry', label: 'Enquiry', x: 300, y: 44, kind: 'start' },
  { id: 'ai', label: 'AI qualifies', x: 526, y: 62, kind: 'ai' },
  { id: 'crm', label: 'CRM updated', x: 546, y: 196, kind: 'ai' },
  { id: 'followup', label: 'Follow-up', x: 526, y: 330, kind: 'end' },
  { id: 'booking', label: 'Appointment', x: 300, y: 348, kind: 'end' },
  { id: 'customer', label: 'Customer', x: 74, y: 330, kind: 'end' },
];

const NODE_W = 132;
const NODE_H = 46;

/** Elbow connectors between consecutive nodes, drawn as rounded polylines. */
function pathBetween(a: Node, b: Node) {
  const from = { x: a.x + NODE_W / 2, y: a.y + NODE_H / 2 };
  const to = { x: b.x + NODE_W / 2, y: b.y + NODE_H / 2 };
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`;
}

/** Closing edge: customer loops back into the website. */
const CLOSING_PATH = `M ${74 + NODE_W / 2} ${330 + NODE_H / 2} L ${74 + NODE_W / 2} 214 L 34 214 L 34 85 L ${74 + NODE_W / 2} 85 L ${74 + NODE_W / 2} ${62 + NODE_H / 2}`;

const PATHS = [
  ...NODES.slice(0, -1).map((node, index) => pathBetween(node, NODES[index + 1]!)),
  CLOSING_PATH,
];

export function GrowthSystem({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const lines = node.querySelectorAll<SVGPathElement>('[data-connector]');
    const groups = node.querySelectorAll<SVGGElement>('[data-node]');

    if (reduced) {
      gsap.set(lines, { strokeDashoffset: 0, opacity: 1 });
      gsap.set(groups, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      // Each connector starts fully dashed-out, then draws itself.
      lines.forEach((line) => {
        const length = line.getTotalLength();
        gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
      });
      gsap.set(groups, { opacity: 0, y: 10 });

      const timeline = gsap.timeline({
        scrollTrigger: { trigger: node, start: 'top 85%', once: true },
        defaults: { ease: 'power2.inOut' },
      });

      lines.forEach((line, index) => {
        timeline.to(line, { strokeDashoffset: 0, duration: 0.55 }, index * 0.13);
      });

      timeline.to(
        groups,
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.09, ease: 'power3.out' },
        0.18,
      );

      // The single ambient element: a short dash travelling the loop.
      const packet = node.querySelector<SVGPathElement>('[data-packet]');
      if (packet) {
        const length = packet.getTotalLength();
        gsap.set(packet, { strokeDasharray: `3 ${length}`, strokeDashoffset: 0, opacity: 0 });
        timeline.to(packet, { opacity: 1, duration: 0.4 }, 1.1);
        gsap.to(packet, {
          strokeDashoffset: -length,
          duration: 7.5,
          ease: 'none',
          repeat: -1,
          delay: 1.4,
        });
      }
    }, node);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <svg
      ref={ref}
      viewBox="0 0 620 400"
      role="img"
      aria-label="The NorthForge automation loop: an enquiry arrives from your website or WhatsApp, AI qualifies it, the CRM is updated, follow-ups and appointment reminders run, and the customer is onboarded — connected in one continuous loop."
      className={cn('h-auto w-full', className)}
    >
      <defs>
        <linearGradient id="nf-connector" x1="0" y1="0" x2="620" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgb(var(--nf-blue))" stopOpacity="0.65" />
          <stop offset="100%" stopColor="rgb(var(--nf-violet))" stopOpacity="0.65" />
        </linearGradient>
      </defs>

      {/* Connectors */}
      {PATHS.map((d, index) => (
        <path
          key={index}
          data-connector
          d={d}
          fill="none"
          stroke="url(#nf-connector)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Travelling packet — the whole loop in one continuous stroke */}
      <path
        data-packet
        d={`${PATHS[0]} ${PATHS.slice(1).map((p) => p.replace(/^M [^L]*/, '')).join(' ')}`}
        fill="none"
        stroke="rgb(var(--nf-blue))"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {NODES.map((node, index) => (
        <g
          key={node.id}
          data-node
          onMouseEnter={() => setActive(node.id)}
          onMouseLeave={() => setActive((current) => (current === node.id ? null : current))}
          style={{ cursor: 'default' }}
        >
          <rect
            x={node.x}
            y={node.y}
            width={NODE_W}
            height={NODE_H}
            rx="12"
            className="fill-[rgb(var(--nf-surface))] stroke-[rgb(var(--nf-line-strong))] transition-[stroke,filter] duration-300"
            style={{
              filter:
                active === node.id
                  ? 'drop-shadow(0 10px 24px rgb(var(--nf-blue) / 0.28))'
                  : undefined,
            }}
            strokeWidth={active === node.id ? 1.6 : 1}
          />
          <circle
            cx={node.x + 18}
            cy={node.y + NODE_H / 2}
            r="3.5"
            fill={
              node.kind === 'ai'
                ? 'rgb(var(--nf-violet))'
                : node.kind === 'end'
                  ? 'rgb(var(--nf-success))'
                  : 'rgb(var(--nf-blue))'
            }
          />
          <text
            x={node.x + 32}
            y={node.y + NODE_H / 2 + 1}
            dominantBaseline="middle"
            className="fill-[rgb(var(--nf-fg))] font-sans text-[13px] font-medium tracking-[0.01em]"
          >
            {node.label}
          </text>
          <text
            x={node.x + NODE_W - 12}
            y={node.y + NODE_H / 2 + 1}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-[rgb(var(--nf-faint))] font-mono text-[10px]"
          >
            {String(index + 1).padStart(2, '0')}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Vertical variant for narrow screens — same story, no shrinking. */
export function GrowthChain({ className }: { className?: string }) {
  return (
    <ol className={cn('space-y-1', className)}>
      {NODES.map((node, index) => (
        <li key={node.id} className="flex items-center gap-3">
          <span className="flex w-5 flex-col items-center">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                node.kind === 'ai'
                  ? 'bg-brand-violet'
                  : node.kind === 'end'
                    ? 'bg-success'
                    : 'bg-brand',
              )}
              aria-hidden
            />
            {index < NODES.length - 1 ? <span className="mt-0.5 h-6 w-px bg-line" aria-hidden /> : null}
          </span>
          <span className="text-[13px] text-fg">{node.label}</span>
          <span className="ml-auto font-mono text-2xs text-faint">{String(index + 1).padStart(2, '0')}</span>
        </li>
      ))}
    </ol>
  );
}
