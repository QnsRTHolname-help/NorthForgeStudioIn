import { useLayoutEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/hooks';

gsap.registerPlugin(ScrollTrigger);

/**
 * 3D Hero Animation Component
 *
 * Creates an immersive 3D visual experience using CSS 3D transforms and GSAP.
 * Features:
 * - Floating geometric shapes with parallax
 * - Rotating 3D wireframe cube
 * - Particle system
 * - Mouse parallax interaction
 * - Respects prefers-reduced-motion
 */
export function Hero3D({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const shapesRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.nativeEvent.clientX - rect.left) / rect.width - 0.5) * 30;
    const y = ((e.nativeEvent.clientY - rect.top) / rect.height - 0.5) * 30;

    gsap.to(cubeRef.current, {
      rotationY: 15 + x * 0.5,
      rotationX: -15 - y * 0.5,
      duration: 0.5,
      ease: 'power2.out',
    });

    gsap.to('.hero-shape', {
      x: (i: number) => (i % 2 === 0 ? x * 0.3 : -x * 0.3),
      y: (i: number) => (i % 3 === 0 ? y * 0.3 : -y * 0.3),
      duration: 0.5,
      ease: 'power2.out',
    });
  }, [reduced]);

  const handleLeave = useCallback(() => {
    if (reduced) return;
    gsap.to(cubeRef.current, {
      rotationY: 15,
      rotationX: -15,
      duration: 1,
      ease: 'elastic.out(1, 0.5)',
    });
    gsap.to('.hero-shape', {
      x: 0,
      y: 0,
      duration: 1,
      ease: 'elastic.out(1, 0.5)',
    });
  }, [reduced]);

  // Native event handlers for addEventListener (used in useLayoutEffect)
  const handleMoveNative = useCallback((e: MouseEvent) => {
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

    gsap.to('.hero-shape', {
      x: (i: number) => (i % 2 === 0 ? x * 0.3 : -x * 0.3),
      y: (i: number) => (i % 3 === 0 ? y * 0.3 : -y * 0.3),
      duration: 0.5,
      ease: 'power2.out',
    });
  }, [reduced]);

  useLayoutEffect(() => {
    if (reduced) return;

    const container = containerRef.current;
    const cube = cubeRef.current;
    const shapes = shapesRef.current;
    if (!container || !cube || !shapes) return;

    const ctx = gsap.context(() => {
      // Initial state
      gsap.set(cube, { rotationX: -15, rotationY: 15, transformPerspective: 1000 });
      gsap.set('.hero-shape', { opacity: 0, scale: 0.5 });
      gsap.set('.hero-particle', { opacity: 0, scale: 0 });

      // Floating shapes animation
      const shapesTimeline = gsap.timeline({
        scrollTrigger: { trigger: container, start: 'top 80%', once: true },
        defaults: { ease: 'power2.out' }
      });

      shapesTimeline
        .to('.hero-shape', {
          opacity: 1,
          scale: 1,
          duration: 1.2,
          stagger: 0.15
        }, 0)
        .to('.hero-particle', {
          opacity: 0.4,
          scale: 1,
          duration: 0.8,
          stagger: 0.03
        }, 0.3);

      // Cube continuous rotation
      gsap.to(cube, {
        rotationY: '+=360',
        duration: 20,
        ease: 'none',
        repeat: -1,
      });

      // Subtle floating animation for shapes
      document.querySelectorAll('.hero-shape').forEach((shape, i) => {
        gsap.to(shape, {
          y: '+=20',
          x: i % 2 === 0 ? '+=15' : '-=15',
          rotation: i % 3 === 0 ? '+=360' : '-=360',
          duration: 3 + i * 0.5,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });

      // Particle float
      document.querySelectorAll('.hero-particle').forEach((particle, i) => {
        gsap.to(particle, {
          y: '+=30',
          x: (i % 2 === 0 ? 1 : -1) * 20,
          duration: 4 + i * 0.3,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });

      // Parallax on scroll
      ScrollTrigger.create({
        trigger: container,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
        onUpdate: (self) => {
          if (!reduced) {
            const progress = self.progress;
            gsap.to(cube, {
              rotationX: -15 + progress * 10,
              rotationY: 15 + progress * 20,
              duration: 0.3,
              ease: 'none',
            });
            gsap.to('.hero-shape', {
              y: progress * 50,
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
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [reduced, handleMove, handleMoveNative, handleLeave]);

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
          <div ref={cubeRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y/1/2 w-64 h-64" style={{ transform: 'translate(-50%, -50%) perspective(1000px) rotateX(-15deg) rotateY(15deg)' }}>
            <WireframeCube />
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

      {/* 3D Wireframe Cube */}
      <div ref={cubeRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64" style={{ transformStyle: 'preserve-3d' }}>
        <WireframeCube />
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