import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/hooks';

gsap.registerPlugin(ScrollTrigger);

/**
 * 3D Hero Animation Component
 *
 * Immersive, Apple-inspired 3D visual experience using CSS 3D transforms and GSAP.
 * Features:
 * - Rotating 3D wireframe cube with luminous corner nodes and edge glow
 * - Floating geometric shapes (circle, square, triangle, hexagon) with parallax
 * - Particle system layered at multiple Z-depths
 * - Smooth pointer/mouse parallax interaction with damping
 * - Constellation connection lines
 * - SSR-safe with clean lifecycle cleanup
 * - Fully respects prefers-reduced-motion
 */
export function Hero3D({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const handleMoveNative = useCallback((e: MouseEvent) => {
    if (reduced) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 36;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 36;

    if (cubeRef.current) {
      gsap.to(cubeRef.current, {
        rotationY: 15 + x * 0.6,
        rotationX: -15 - y * 0.6,
        duration: 0.6,
        ease: 'power2.out',
      });
    }

    const shapes = container.querySelectorAll('.hero-shape');
    if (shapes.length > 0) {
      gsap.to(shapes, {
        x: (i: number) => (i % 2 === 0 ? x * 0.35 : -x * 0.35),
        y: (i: number) => (i % 3 === 0 ? y * 0.35 : -y * 0.35),
        duration: 0.6,
        ease: 'power2.out',
      });
    }
  }, [reduced]);

  const handleLeave = useCallback(() => {
    if (reduced || !containerRef.current) return;
    if (cubeRef.current) {
      gsap.to(cubeRef.current, {
        rotationY: 15,
        rotationX: -15,
        duration: 1.2,
        ease: 'elastic.out(1, 0.4)',
      });
    }
    const shapes = containerRef.current.querySelectorAll('.hero-shape');
    if (shapes.length > 0) {
      gsap.to(shapes, {
        x: 0,
        y: 0,
        duration: 1.2,
        ease: 'elastic.out(1, 0.4)',
      });
    }
  }, [reduced]);

  useEffect(() => {
    if (reduced || typeof window === 'undefined') return;

    const container = containerRef.current;
    const cube = cubeRef.current;
    if (!container || !cube) return;

    const ctx = gsap.context(() => {
      // Set initial 3D transform orientations
      gsap.set(cube, { rotationX: -15, rotationY: 15, transformPerspective: 1000 });
      gsap.set('.hero-shape', { opacity: 0, scale: 0.6 });
      gsap.set('.hero-particle', { opacity: 0, scale: 0 });

      // Entrance animation timeline
      const entranceTl = gsap.timeline({
        defaults: { ease: 'power2.out' },
      });

      entranceTl
        .to('.hero-shape', {
          opacity: 1,
          scale: 1,
          duration: 1.2,
          stagger: 0.12,
        }, 0.1)
        .to('.hero-particle', {
          opacity: 0.5,
          scale: 1,
          duration: 0.9,
          stagger: 0.03,
        }, 0.3);

      // Continuous slow 3D rotation of wireframe cube
      gsap.to(cube, {
        rotationY: '+=360',
        duration: 24,
        ease: 'none',
        repeat: -1,
      });

      // Floating oscillation for individual geometric shapes
      container.querySelectorAll('.hero-shape').forEach((shape, i) => {
        gsap.to(shape, {
          y: '+=18',
          x: i % 2 === 0 ? '+=12' : '-=12',
          rotation: i % 3 === 0 ? '+=180' : '-=180',
          duration: 4 + i * 0.6,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });

      // Gentle drift for particles
      container.querySelectorAll('.hero-particle').forEach((particle, i) => {
        gsap.to(particle, {
          y: '+=24',
          x: (i % 2 === 0 ? 1 : -1) * 16,
          duration: 3.5 + i * 0.4,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });

      // Parallax scroll link
      ScrollTrigger.create({
        trigger: container,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2,
        onUpdate: (self) => {
          if (!reduced && cube) {
            const p = self.progress;
            gsap.to(cube, {
              rotationX: -15 + p * 12,
              rotationY: 15 + p * 24,
              duration: 0.3,
              ease: 'none',
            });
          }
        },
      });
    }, container);

    container.addEventListener('mousemove', handleMoveNative);
    container.addEventListener('mouseleave', handleLeave);

    return () => {
      ctx.revert();
      container.removeEventListener('mousemove', handleMoveNative);
      container.removeEventListener('mouseleave', handleLeave);
    };
  }, [reduced, handleMoveNative, handleLeave]);

  // Floating geometric elements
  const floatingShapes = Array.from({ length: 8 }, (_, i) => {
    const size = 36 + (i % 3) * 26;
    const shapes = ['circle', 'square', 'triangle', 'hexagon'] as const;
    const shapeType = shapes[i % shapes.length];
    const delay = i * 0.12;

    return (
      <div
        key={i}
        className="hero-shape absolute pointer-events-none"
        style={{
          width: size,
          height: size,
          left: `${12 + (i % 4) * 22}%`,
          top: `${14 + Math.floor(i / 4) * 36}%`,
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

  // Particle field
  const particles = Array.from({ length: 20 }, (_, i) => (
    <div
      key={i}
      className="hero-particle absolute pointer-events-none rounded-full"
      style={{
        width: 4 + (i % 3) * 2,
        height: 4 + (i % 3) * 2,
        left: `${6 + (i % 5) * 18}%`,
        top: `${8 + Math.floor(i / 5) * 24}%`,
        backgroundColor: [
          'rgb(var(--nf-blue))',
          'rgb(var(--nf-violet))',
          'rgb(var(--nf-cyan))',
          'rgb(var(--nf-amber))',
        ][i % 4],
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
          <div
            ref={cubeRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64"
            style={{
              transform: 'translate(-50%, -50%) perspective(1000px) rotateX(-15deg) rotateY(15deg)',
            }}
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
      {/* Deep particle layer */}
      <div className="absolute inset-0" style={{ transform: 'translateZ(-100px) scale(1.1)' }}>
        {particles}
      </div>

      {/* Floating geometric layer */}
      <div className="absolute inset-0" style={{ transform: 'translateZ(-50px) scale(1.05)' }}>
        {floatingShapes}
      </div>

      {/* 3D Wireframe Cube with rotating perspective */}
      <div
        ref={cubeRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <WireframeCube />
      </div>

      {/* Constellation connection lines */}
      <div className="absolute inset-0 pointer-events-none" style={{ transform: 'translateZ(0)' }}>
        <ConnectionLines />
      </div>
    </div>
  );
}

/**
 * 3D Wireframe Cube with animated luminous edges
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
    { vertices: [0, 1, 2, 3], color: 'rgba(var(--nf-blue), 0.06)', stroke: 'rgb(var(--nf-blue))' },
    { vertices: [4, 5, 6, 7], color: 'rgba(var(--nf-violet), 0.06)', stroke: 'rgb(var(--nf-violet))' },
    { vertices: [0, 1, 5, 4], color: 'rgba(var(--nf-cyan), 0.04)', stroke: 'rgb(var(--nf-cyan))' },
    { vertices: [2, 3, 7, 6], color: 'rgba(var(--nf-amber), 0.04)', stroke: 'rgb(var(--nf-amber))' },
    { vertices: [1, 2, 6, 5], color: 'rgba(var(--nf-blue), 0.05)', stroke: 'rgb(var(--nf-blue))' },
    { vertices: [0, 3, 7, 4], color: 'rgba(var(--nf-violet), 0.05)', stroke: 'rgb(var(--nf-violet))' },
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
        <filter id="nf-cube-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Faces with luminous gradient */}
      {faces.map((face, i) => (
        <polygon
          key={i}
          points={face.vertices.map((v) => `${vertices[v][0]},${vertices[v][1]}`).join(' ')}
          fill={face.color}
          stroke={face.stroke}
          strokeWidth="0.5"
          opacity="0.35"
          filter="url(#nf-cube-glow)"
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
          opacity="0.65"
          filter="url(#nf-cube-glow)"
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
          opacity="0.85"
          filter="url(#nf-cube-glow)"
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
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
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
