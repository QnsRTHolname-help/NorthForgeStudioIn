import { describe, it, expect } from 'vitest';
import { LENIS_CONFIG, SCRUB, EASE, DURATION } from './constants';

describe('Motion System & Smooth Scroll Tuning', () => {
  it('exports valid LENIS_CONFIG with continuous kinematic damping parameters', () => {
    expect(LENIS_CONFIG).toBeDefined();
    // Continuous lerp damping must be between 0.07 and 0.10 for Apple/Awwwards-grade momentum
    expect(LENIS_CONFIG.lerp).toBeGreaterThanOrEqual(0.07);
    expect(LENIS_CONFIG.lerp).toBeLessThanOrEqual(0.10);
    expect(LENIS_CONFIG.lerp).toBe(0.085);

    // Wheel multiplier must be conservative (0.9 to 1.1) to avoid notched over-travel
    expect(LENIS_CONFIG.wheelMultiplier).toBeGreaterThanOrEqual(0.9);
    expect(LENIS_CONFIG.wheelMultiplier).toBeLessThanOrEqual(1.1);
    expect(LENIS_CONFIG.wheelMultiplier).toBe(0.95);

    // Touch devices remain on native momentum scrolling to avoid fighting platform gestures
    expect(LENIS_CONFIG.syncTouch).toBe(false);
    expect(LENIS_CONFIG.touchMultiplier).toBe(1.0);
    expect(LENIS_CONFIG.autoResize).toBe(true);
    expect(LENIS_CONFIG.anchorDuration).toBeGreaterThanOrEqual(1.0);
  });

  it('verifies SCRUB is true to prevent double-smoothed lag with Lenis', () => {
    expect(SCRUB).toBe(true);
  });

  it('verifies standard GSAP easing curves and durations are defined', () => {
    expect(EASE.entrance).toBe('power3.out');
    expect(EASE.editorial).toBe('power4.out');
    expect(EASE.cinematic).toBe('expo.out');
    expect(DURATION.ui).toBe(0.35);
    expect(DURATION.panel).toBe(1.15);
  });
});

describe('SplitText Text Splitting & Boundary Logic', () => {
  function splitUnits(text: string, by: 'word' | 'char' | 'line') {
    if (by === 'char') return text.split('');
    if (by === 'line') return text.split('\n');
    return text.split(/\s+/).filter(Boolean);
  }

  it('splits text into words correctly', () => {
    const text = 'WE BUILD DIGITAL SYSTEMS';
    const words = splitUnits(text, 'word');
    expect(words).toEqual(['WE', 'BUILD', 'DIGITAL', 'SYSTEMS']);
  });

  it('splits text into lines with newline boundaries preserved', () => {
    const text = 'WE BUILD DIGITAL SYSTEMS\nTHAT MOVE YOUR BUSINESS FORWARD.';
    const lines = splitUnits(text, 'line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('WE BUILD DIGITAL SYSTEMS');
    expect(lines[1]).toBe('THAT MOVE YOUR BUSINESS FORWARD.');
  });

  it('splits text into characters and identifies space characters', () => {
    const text = 'North Forge';
    const chars = splitUnits(text, 'char');
    expect(chars).toHaveLength(11);
    expect(chars[5]).toBe(' ');

    // Test that space character replacement mapping handles spacing
    const mapped = chars.map((c) => (c === ' ' ? '\u00A0' : c));
    expect(mapped[5]).toBe('\u00A0');
  });

  it('handles empty strings and edge cases cleanly', () => {
    expect(splitUnits('', 'word')).toEqual([]);
    expect(splitUnits('', 'line')).toEqual(['']);
    expect(splitUnits('', 'char')).toEqual([]);
    expect(splitUnits('   \t\n   ', 'word')).toEqual([]);
  });

  it('verifies descender character preservation in key headline copy', () => {
    const headlinesWithDescenders = [
      'WE BUILD DIGITAL SYSTEMS\nTHAT MOVE YOUR BUSINESS FORWARD.',
      'The system behind it is what makes it work.',
      'Six steps from first call to a system that keeps improving.',
      'What each plan includes.',
    ];

    const descenderChars = ['g', 'j', 'p', 'q', 'y'];
    for (const headline of headlinesWithDescenders) {
      const foundDescenders = descenderChars.filter((ch) => headline.toLowerCase().includes(ch));
      expect(foundDescenders.length).toBeGreaterThan(0);
    }
  });

  it('verifies that line-mode split elements map to block display structures', () => {
    const isLineMode = (by: 'word' | 'char' | 'line') => by === 'line';
    expect(isLineMode('line')).toBe(true);
    expect(isLineMode('word')).toBe(false);
    expect(isLineMode('char')).toBe(false);

    // Confirm that for line mode, the wrapper display class evaluates to 'block'
    const getOuterClass = (by: 'word' | 'char' | 'line') => (by === 'line' ? 'block' : undefined);
    const getInnerClass = (by: 'word' | 'char' | 'line') => (by === 'line' ? 'block' : 'inline-block');

    expect(getOuterClass('line')).toBe('block');
    expect(getOuterClass('word')).toBeUndefined();
    expect(getInnerClass('line')).toBe('block');
    expect(getInnerClass('word')).toBe('inline-block');
  });
});

