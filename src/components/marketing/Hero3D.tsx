import { useLayoutEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { useReducedMotion } from '@/hooks';

/**
 * 3D Hero Animation Component
 *
 * Creates an immersive 3D visual experience using CSS 3D transforms and GSAP.
 *
 * Performance note: the continuous decorative motion (cube spin, floating
 * shapes, particles) runs on CSS `@keyframes` rather than GSAP repeat tweens.
 * That keeps the hero out of the JS thread entirely once it has mounted —
 * the only GSAP work left is the one-shot entrance and the pointer parallax.
 */
export function Hero3D({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 30;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 30;

    gsap.to(cubeRef.current, {
      rotationY: 15 + x * 0.5,
      rotationX: -15 - y * 0.5,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, [reduced]);

  const handleLeave = useCallback(() => {
    if (reduced) return;
    gsap.to(cubeRef.current, {
      rotationY: 15,
      rotationX: -15,
      duration: 0.8,
      ease: 'power2.out',
    });
  }, [reduced]);

  useLayoutEffect(() => {
    if (reduced) return;

    const container = containerRef.current;
    const cube = cubeRef.current;
    if (!container || !cube) return;

    const ctx = gsap.context(() => {
      // One-shot entrance: the cube and its surrounding shapes scale up as
      // the panel rises. No repeat tweens — the rest of the motion is CSS.
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.fromTo(
        cube,
        { opacity: 0, scale: 0.6, rotationX: -15, rotationY: 15 },
        { opacity: 1, scale: 1, rotationX: -15, rotationY: 15, duration: 1.2 },
        0,
      ).fromTo(
        '.hero-shape',
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 1, stagger: 0.12 },
        0.15,
      ).fromTo(
        '.hero-particle',
        { opacity: 0, scale: 0 },
        { opacity: 0.5, scale: 1, duration: 0.7, stagger: 0.03 },
        0.4,
      );
    }, container);

    return () => ctx.revert();
  }, [reduced]);

  // Generate floating shapes
  const floatingShapes = Array.from({ length: 8 }, (_, i) => {
    const size = 40 + (i % 3) * 30;
    const shapes = ['circle', 'square', 'triangle', 'hexagon'];
    const shapeType = shapes[i % shapes.length];
    const delay = i * 0.15;

    return (
      <div
        key={i}
        className="hero-shape absolute pointer-events-none"
        style={{
          width: size,
          height: size,
          left: `${10 + (i % 4) * 22}%`,
          top: `${15 + Math.floor(i / 4) * 35}%`,
          animationDelay: `${delay}s`,
        }}
        data-depth={0.5 + i * 0.1}
      >
        {shapeType === 'circle' && (
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgb(var(--nf-blue))" strokeWidth="1.5" opacity="0.4" />
            <circle cx="50" cy="50" r="30" fill="rgb(var(--nf-blue))" opacity="0.08" />
          </svg>
        )}
        {shapeType === 'square' && (
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            <rect x="2" y="2" width="96" height="96" rx="8" fill="none" stroke="rgb(var(--nf-violet))" strokeWidth="1.5" opacity="0.4" />
            <rect x="20" y="20" width="60" height="60" rx="4" fill="rgb(var(--nf-violet))" opacity="0.08" />
          </svg>
        )}
        {shapeType === 'triangle' && (
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            <path d="M50 5 L95 95 L5 95 Z" fill="none" stroke="rgb(var(--nf-cyan))" strokeWidth="1.5" opacity="0.4" />
            <path d="M50 18 L82 82 L18 82 Z" fill="rgb(var(--nf-cyan))" opacity="0.08" />
          </svg>
        )}
        {shapeType === 'hexagon' && (
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
            <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="none" stroke="rgb(var(--nf-amber))" strokeWidth="1.5" opacity="0.4" />
            <polygon points="50,18 82,34 82,66 50,82 18,66 18,34" fill="rgb(var(--nf-amber))" opacity="0.08" />
          </svg>
        )}
      </div>
    );
  });

  // Generate particles
  const particles = Array.from({ length: 20 }, (_, i) => (
    <div
      key={i}
      className="hero-particle absolute pointer-events-none rounded-full"
      style={{
        width: 4 + (i % 3) * 2,
        height: 4 + (i % 3) * 2,
        left: `${5 + (i % 5) * 18}%`,
        top: `${10 + Math.floor(i / 5) * 25}%`,
        backgroundColor: ['rgb(var(--nf-blue))', 'rgb(var(--nf-violet))', 'rgb(var(--nf-cyan))', 'rgb(var(--nf-amber))'][i % 4],
        opacity: 0,
        animationDelay: `${i * 0.05}s`,
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
        <div className="absolute inset-0" style={{ transform: 'translateZ(0)' }}>
          {floatingShapes}
          {particles}
          <div ref={cubeRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64" style={{ transform: 'translate(-50%, -50%) perspective(1000px) rotateX(-15deg) rotateY(15deg)' }}>
            <div className="hero-cube-spin h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
              <WireframeCube />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ perspective: 1000 }}
    >
      {/* Depth layers for parallax */}
      <div className="absolute inset-0" style={{ transform: 'translateZ(-100px) scale(1.1)' }}>
        {particles}
      </div>

      <div className="absolute inset-0" style={{ transform: 'translateZ(-50px) scale(1.05)' }}>
        {floatingShapes}
      </div>

      {/* 3D Wireframe Cube.
          `cubeRef` is the outer wrapper — GSAP drives its rotationY for the
          pointer parallax. The spin itself lives on the inner element so the
          two transforms never fight over the same property. */}
      <div ref={cubeRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
        <div className="hero-cube-spin h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
          <WireframeCube />
        </div>
      </div>

      {/* Connection lines */}
      <div className="absolute inset-0 pointer-events-none" style={{ transform: 'translateZ(0)' }}>
        <ConnectionLines />
      </div>
    </div>
  );
}

/**
 * 3D Wireframe Cube with animated edges
 */
function WireframeCube() {
  const size = 120;
  const half = size / 2;

  // Define cube vertices
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

  // Define edges
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0], // back face
    [4, 5], [5, 6], [6, 7], [7, 4], // front face
    [0, 4], [1, 5], [2, 6], [3, 7], // connecting edges
  ];

  // Define faces for gradient fills
  const faces = [
    { vertices: [0, 1, 2, 3], color: 'rgba(var(--nf-blue), 0.05)', stroke: 'rgb(var(--nf-blue))' }, // back
    { vertices: [4, 5, 6, 7], color: 'rgba(var(--nf-violet), 0.05)', stroke: 'rgb(var(--nf-violet))' }, // front
    { vertices: [0, 1, 5, 4], color: 'rgba(var(--nf-cyan), 0.03)', stroke: 'rgb(var(--nf-cyan))' }, // bottom
    { vertices: [2, 3, 7, 6], color: 'rgba(var(--nf-amber), 0.03)', stroke: 'rgb(var(--nf-amber))' }, // top
    { vertices: [1, 2, 6, 5], color: 'rgba(var(--nf-blue), 0.04)', stroke: 'rgb(var(--nf-blue))' }, // right
    { vertices: [0, 3, 7, 4], color: 'rgba(var(--nf-violet), 0.04)', stroke: 'rgb(var(--nf-violet))' }, // left
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      className="w-full h-full"
      style={{ transformStyle: 'preserve-3d' }}
      aria-hidden="true"
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Faces with subtle gradient */}
      {faces.map((face, i) => (
        <polygon
          key={i}
          points={face.vertices.map(v => `${vertices[v][0]},${vertices[v][1]}`).join(' ')}
          fill={face.color}
          stroke={face.stroke}
          strokeWidth="0.5"
          opacity="0.3"
          filter="url(#glow)"
          className="cube-face"
        />
      ))}

      {/* Edges */}
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={vertices[a][0]}
          y1={vertices[a][1]}
          x2={vertices[b][0]}
          y2={vertices[b][1]}
          stroke={i < 4 ? 'rgb(var(--nf-blue))' : i < 8 ? 'rgb(var(--nf-violet))' : 'rgb(var(--nf-cyan))'}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
          filter="url(#glow)"
          className="cube-edge"
        />
      ))}

      {/* Corner nodes */}
      {vertices.map((v, i) => (
        <circle
          key={i}
          cx={v[0]}
          cy={v[1]}
          r="3"
          fill={i < 4 ? 'rgb(var(--nf-blue))' : 'rgb(var(--nf-violet))'}
          opacity="0.8"
          filter="url(#glow)"
          className="cube-node"
        />
      ))}
    </svg>
  );
}

/**
 * Animated connection lines between shapes
 */
function ConnectionLines() {
  const points = [
    { x: '15%', y: '20%' },
    { x: '35%', y: '18%' },
    { x: '55%', y: '35%' },
    { x: '75%', y: '22%' },
    { x: '85%', y: '45%' },
    { x: '70%', y: '65%' },
    { x: '50%', y: '78%' },
    { x: '30%', y: '72%' },
    { x: '12%', y: '55%' },
  ];

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--nf-blue))" stopOpacity="0.3" />
          <stop offset="50%" stopColor="rgb(var(--nf-violet))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="rgb(var(--nf-cyan))" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Main polygon */}
      <polygon
        points={points.map(p => `${p.x} ${p.y}`).join(' ')}
        fill="none"
        stroke="url(#connection-gradient)"
        strokeWidth="0.8"
        strokeDasharray="8 4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
        className="connection-polygon"
      />

      {/* Inner connections to center */}
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
          className="connection-spoke"
        />
      ))}
    </svg>
  );
}

export default Hero3D;