import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useReducedMotion } from '@/hooks';

/**
 * 3D Hero Visual Component
 *
 * Immersive, Apple-inspired 3D visual experience engineered for 60-120fps fluid smoothness:
 * - Pure hardware-accelerated CSS 3D perspective wireframe cube (no JS tween fighting)
 * - Decoupled pointer parallax powered by gsap.quickTo (zero heap churn per mousemove)
 * - Composite-thread floating geometry and multi-depth particle field
 * - GPU drop-shadow illumination (replaces laggy SVG feGaussianBlur CPU rasterization)
 * - Passive event listeners and instant SSR-safe lifecycle cleanup
 * - Fully respects prefers-reduced-motion
 */
export function Hero3D({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const quickTiltXRef = useRef<((value: number) => void) | null>(null);
  const quickTiltYRef = useRef<((value: number) => void) | null>(null);



  useEffect(() => {
    if (reduced || typeof window === 'undefined') return;

    const container = containerRef.current;
    const tilt = tiltRef.current;
    if (!container || !tilt) return;

    // Initialize high-performance quickTo dampeners
    quickTiltXRef.current = gsap.quickTo(tilt, 'rotationY', { duration: 0.7, ease: 'power2.out' });
    quickTiltYRef.current = gsap.quickTo(tilt, 'rotationX', { duration: 0.7, ease: 'power2.out' });

    const ctx = gsap.context(() => {
      // Set initial 3D transform orientations
      gsap.set(tilt, { transformPerspective: 1000, transformStyle: 'preserve-3d' });

      // Clean one-shot entrance timeline animating the layers so individual shapes & particles
      // keep their continuous CSS GPU keyframes completely uninterrupted without style collisions.
      const entranceTl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      entranceTl
        .fromTo('[data-shape-layer]', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1.05, duration: 1.1 }, 0.1)
        .fromTo('[data-particle-layer]', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0.25);
    }, container);

    // Cache container geometry to eliminate layout thrashing during mouse movement
    let containerRect = container.getBoundingClientRect();
    const updateRect = () => {
      if (container) containerRect = container.getBoundingClientRect();
    };
    window.addEventListener('resize', updateRect, { passive: true });
    window.addEventListener('scroll', updateRect, { passive: true });

    let ticking = false;
    const onWindowMove = (e: MouseEvent) => {
      if (reduced || !quickTiltXRef.current || !quickTiltYRef.current) return;
      if (window.scrollY > 800) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!container) return;
        const rect = containerRect;
        // Only react if pointer is within a reasonable proximity of the hero area
        if (
          e.clientX < rect.left - 240 ||
          e.clientX > rect.right + 240 ||
          e.clientY < rect.top - 240 ||
          e.clientY > rect.bottom + 240
        ) {
          quickTiltXRef.current?.(0);
          quickTiltYRef.current?.(0);
          return;
        }
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 28;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 28;
        quickTiltXRef.current?.(x * 0.35);
        quickTiltYRef.current?.(-y * 0.35);
      });
    };

    const onWindowLeave = () => {
      if (quickTiltXRef.current && quickTiltYRef.current) {
        quickTiltXRef.current(0);
        quickTiltYRef.current(0);
      }
    };

    window.addEventListener('mousemove', onWindowMove, { passive: true });
    document.addEventListener('mouseleave', onWindowLeave, { passive: true });

    return () => {
      ctx.revert();
      quickTiltXRef.current = null;
      quickTiltYRef.current = null;
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      window.removeEventListener('mousemove', onWindowMove);
      document.removeEventListener('mouseleave', onWindowLeave);
    };
  }, [reduced]);

  // Floating geometric elements (animated via CSS GPU keyframes)
  const floatingShapes = Array.from({ length: 8 }, (_, i) => {
    const size = 36 + (i % 3) * 24;
    const shapes = ['circle', 'square', 'triangle', 'hexagon'] as const;
    const shapeType = shapes[i % shapes.length];
    const delay = i * 0.14;

    return (
      <div
        key={i}
        className="hero-shape absolute pointer-events-none nf-gpu"
        style={{
          width: size,
          height: size,
          left: `${10 + (i % 4) * 24}%`,
          top: `${12 + Math.floor(i / 4) * 38}%`,
          animationDelay: `${delay}s`,
        }}
        data-depth={0.5 + i * 0.1}
      >
        {shapeType === 'circle' && (
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgb(var(--nf-blue))" strokeWidth="1.5" opacity="0.45" />
            <circle cx="50" cy="50" r="30" fill="rgb(var(--nf-blue))" opacity="0.10" />
          </svg>
        )}
        {shapeType === 'square' && (
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            <rect x="2" y="2" width="96" height="96" rx="8" fill="none" stroke="rgb(var(--nf-violet))" strokeWidth="1.5" opacity="0.45" />
            <rect x="20" y="20" width="60" height="60" rx="4" fill="rgb(var(--nf-violet))" opacity="0.10" />
          </svg>
        )}
        {shapeType === 'triangle' && (
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            <path d="M50 5 L95 95 L5 95 Z" fill="none" stroke="rgb(var(--nf-cyan))" strokeWidth="1.5" opacity="0.45" />
            <path d="M50 18 L82 82 L18 82 Z" fill="rgb(var(--nf-cyan))" opacity="0.10" />
          </svg>
        )}
        {shapeType === 'hexagon' && (
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="none" stroke="rgb(var(--nf-amber))" strokeWidth="1.5" opacity="0.45" />
            <polygon points="50,18 82,34 82,66 50,82 18,66 18,34" fill="rgb(var(--nf-amber))" opacity="0.10" />
          </svg>
        )}
      </div>
    );
  });

  // Particle field (animated via CSS GPU keyframes)
  const particles = Array.from({ length: 18 }, (_, i) => (
    <div
      key={i}
      className="hero-particle absolute pointer-events-none rounded-full nf-gpu"
      style={{
        width: 4 + (i % 3) * 2,
        height: 4 + (i % 3) * 2,
        left: `${7 + (i % 5) * 19}%`,
        top: `${8 + Math.floor(i / 5) * 25}%`,
        backgroundColor: [
          'rgb(var(--nf-blue))',
          'rgb(var(--nf-violet))',
          'rgb(var(--nf-cyan))',
          'rgb(var(--nf-amber))',
        ][i % 4],
        opacity: 0,
        animationDelay: `${i * 0.08}s`,
      }}
      data-depth={0.8 + i * 0.01}
    />
  ));

  if (reduced) {
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden ${className}`}
        aria-hidden="true"
      >
        <div className="absolute inset-0">
          {floatingShapes}
          {particles}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64"
            style={{ transform: 'translate(-50%, -50%) rotateX(-15deg) rotateY(15deg)' }}
          >
            <WireframeCube />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ perspective: 1000 }}
    >
      {/* Decoupled interactive parallax wrapper */}
      <div
        ref={tiltRef}
        className="absolute inset-0 w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Deep particle layer */}
        <div data-particle-layer className="absolute inset-0 nf-gpu will-change-transform" style={{ transform: 'translateZ(-90px) scale(1.1)' }}>
          {particles}
        </div>

        {/* Floating geometric layer */}
        <div data-shape-layer className="absolute inset-0 nf-gpu will-change-transform" style={{ transform: 'translateZ(-45px) scale(1.05)' }}>
          {floatingShapes}
        </div>

        {/* 3D Wireframe Cube with continuous pure-GPU rotation */}
        <div
          className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-52 h-52 sm:w-60 sm:h-60"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="hero-cube-spin w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
            <WireframeCube />
          </div>
        </div>

        {/* Constellation connection lines */}
        <div className="absolute inset-0 pointer-events-none" style={{ transform: 'translateZ(0)' }}>
          <ConnectionLines />
        </div>
      </div>
    </div>
  );
}

/**
 * 3D Wireframe Cube with GPU-accelerated luminous edges
 * Uses CSS drop-shadow instead of CPU-bound SVG feGaussianBlur filter.
 */
function WireframeCube() {
  const size = 124;
  const half = size / 2;

  // Cube vertices in 3D space
  const vertices = [
    [-half, -half, -half], // 0
    [half, -half, -half],  // 1
    [half, half, -half],   // 2
    [-half, half, -half],  // 3
    [-half, -half, half],  // 4
    [half, -half, half],   // 5
    [half, half, half],    // 6
    [-half, half, half],   // 7
  ];

  // Cube edges connecting vertices
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0], // back face
    [4, 5], [5, 6], [6, 7], [7, 4], // front face
    [0, 4], [1, 5], [2, 6], [3, 7], // connecting edges
  ];

  // Translucent luminous faces
  const faces = [
    { vertices: [0, 1, 2, 3], color: 'rgba(var(--nf-blue), 0.08)', stroke: 'rgb(var(--nf-blue))' },
    { vertices: [4, 5, 6, 7], color: 'rgba(var(--nf-violet), 0.08)', stroke: 'rgb(var(--nf-violet))' },
    { vertices: [0, 1, 5, 4], color: 'rgba(var(--nf-cyan), 0.05)', stroke: 'rgb(var(--nf-cyan))' },
    { vertices: [2, 3, 7, 6], color: 'rgba(var(--nf-amber), 0.05)', stroke: 'rgb(var(--nf-amber))' },
    { vertices: [1, 2, 6, 5], color: 'rgba(var(--nf-blue), 0.06)', stroke: 'rgb(var(--nf-blue))' },
    { vertices: [0, 3, 7, 4], color: 'rgba(var(--nf-violet), 0.06)', stroke: 'rgb(var(--nf-violet))' },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      className="w-full h-full nf-gpu"
      style={{
        transformStyle: 'preserve-3d',
      }}
      aria-hidden="true"
    >
      {/* Faces with luminous gradient */}
      {faces.map((face, i) => (
        <polygon
          key={i}
          points={face.vertices.map((v) => `${vertices[v][0]},${vertices[v][1]}`).join(' ')}
          fill={face.color}
          stroke={face.stroke}
          strokeWidth="0.6"
          opacity="0.45"
          className="cube-face"
        />
      ))}

      {/* Wireframe edges */}
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={vertices[a][0]}
          y1={vertices[a][1]}
          x2={vertices[b][0]}
          y2={vertices[b][1]}
          stroke={i < 4 ? 'rgb(var(--nf-blue))' : i < 8 ? 'rgb(var(--nf-violet))' : 'rgb(var(--nf-cyan))'}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.75"
          className="cube-edge"
        />
      ))}

      {/* Corner luminous nodes */}
      {vertices.map((v, i) => (
        <circle
          key={i}
          cx={v[0]}
          cy={v[1]}
          r="3"
          fill={i < 4 ? 'rgb(var(--nf-blue))' : 'rgb(var(--nf-violet))'}
          opacity="0.9"
          className="cube-node"
        />
      ))}
    </svg>
  );
}

/**
 * Animated constellation connection lines between shapes
 */
function ConnectionLines() {
  const points = [
    { x: '14%', y: '20%' },
    { x: '34%', y: '16%' },
    { x: '56%', y: '32%' },
    { x: '76%', y: '20%' },
    { x: '86%', y: '44%' },
    { x: '72%', y: '66%' },
    { x: '48%', y: '78%' },
    { x: '28%', y: '70%' },
    { x: '12%', y: '54%' },
  ];

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full nf-gpu" aria-hidden>
      <defs>
        <linearGradient id="nf-conn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--nf-blue))" stopOpacity="0.35" />
          <stop offset="50%" stopColor="rgb(var(--nf-violet))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(var(--nf-cyan))" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* Outer constellation perimeter */}
      <polygon
        points={points.map((p) => `${p.x} ${p.y}`).join(' ')}
        fill="none"
        stroke="url(#nf-conn-grad)"
        strokeWidth="0.8"
        strokeDasharray="6 4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />

      {/* Spokes connecting to center */}
      {points.map((p, i) => (
        <line
          key={i}
          x1={p.x}
          y1={p.y}
          x2="50%"
          y2="50%"
          stroke="rgb(var(--nf-blue))"
          strokeWidth="0.5"
          strokeDasharray="4 4"
          opacity="0.2"
        />
      ))}
    </svg>
  );
}

export default Hero3D;
