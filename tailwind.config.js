/**
 * NorthForge design tokens.
 *
 * Every colour resolves through a CSS variable so a single `data-theme`
 * attribute on <html> re-skins the entire product (dark / light / system).
 * Never hard-code a hex value in a component — add a token here instead.
 */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    darkMode: ['class', '[data-theme="dark"]'],
    theme: {
        extend: {
            colors: {
                canvas: 'rgb(var(--nf-canvas) / <alpha-value>)',
                surface: 'rgb(var(--nf-surface) / <alpha-value>)',
                elevated: 'rgb(var(--nf-elevated) / <alpha-value>)',
                sunken: 'rgb(var(--nf-sunken) / <alpha-value>)',
                line: 'rgb(var(--nf-line) / <alpha-value>)',
                'line-strong': 'rgb(var(--nf-line-strong) / <alpha-value>)',
                fg: 'rgb(var(--nf-fg) / <alpha-value>)',
                muted: 'rgb(var(--nf-muted) / <alpha-value>)',
                faint: 'rgb(var(--nf-faint) / <alpha-value>)',
                brand: {
                    DEFAULT: 'rgb(var(--nf-blue) / <alpha-value>)',
                    blue: 'rgb(var(--nf-blue) / <alpha-value>)',
                    violet: 'rgb(var(--nf-violet) / <alpha-value>)',
                    soft: 'rgb(var(--nf-blue-soft) / <alpha-value>)',
                    deep: 'rgb(var(--nf-blue-deep) / <alpha-value>)',
                },
                success: 'rgb(var(--nf-success) / <alpha-value>)',
                warning: 'rgb(var(--nf-warning) / <alpha-value>)',
                danger: 'rgb(var(--nf-danger) / <alpha-value>)',
                info: 'rgb(var(--nf-info) / <alpha-value>)',
            },
            fontFamily: {
                sans: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                display: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
                mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
            },
            fontSize: {
                '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
                display: ['clamp(2.75rem, 7.2vw, 6.25rem)', { lineHeight: '0.94', letterSpacing: '-0.035em', fontWeight: '600' }],
                // Editorial hero headline — the type is the design (spec §30).
                hero: ['clamp(3rem, 8.2vw, 7.25rem)', { lineHeight: '0.96', letterSpacing: '-0.04em', fontWeight: '600' }],
                // Section-level statement heading.
                'display-lg': ['clamp(2.5rem, 5.2vw, 4.5rem)', { lineHeight: '1.0', letterSpacing: '-0.035em', fontWeight: '600' }],
                'display-sm': ['clamp(2.1rem, 4.6vw, 3.6rem)', { lineHeight: '1.0', letterSpacing: '-0.03em', fontWeight: '600' }],
                headline: ['clamp(1.5rem, 2.4vw, 2.125rem)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
            },
            letterSpacing: {
                eyebrow: '0.18em',
            },
            borderRadius: {
                xs: '3px',
                sm: '5px',
                DEFAULT: '6px',
                md: '8px',
                lg: '12px',
                xl: '16px',
                '2xl': '20px',
            },
            boxShadow: {
                soft: 'var(--nf-shadow-soft)',
                lift: 'var(--nf-shadow-lift)',
                panel: 'var(--nf-shadow-panel)',
                glow: '0 0 0 1px rgb(var(--nf-blue) / 0.35), 0 12px 40px -12px rgb(var(--nf-blue) / 0.45)',
            },
            transitionTimingFunction: {
                forge: 'cubic-bezier(0.16, 1, 0.3, 1)',
                swift: 'cubic-bezier(0.32, 0.72, 0, 1)',
            },
            maxWidth: {
                shell: '1360px',
                prose: '68ch',
            },
            keyframes: {
                marquee: {
                    '0%': { transform: 'translate3d(0,0,0)' },
                    '100%': { transform: 'translate3d(-50%,0,0)' },
                },
                shimmer: {
                    '100%': { transform: 'translateX(100%)' },
                },
                'fade-up': {
                    '0%': { opacity: '0', transform: 'translate3d(0,10px,0)' },
                    '100%': { opacity: '1', transform: 'none' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.97)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'slide-in-right': {
                    '0%': { transform: 'translate3d(100%, 0, 0)' },
                    '100%': { transform: 'translate3d(0, 0, 0)' },
                },
                'slide-in-left': {
                    '0%': { transform: 'translate3d(-100%, 0, 0)' },
                    '100%': { transform: 'translate3d(0, 0, 0)' },
                },
                'pulse-ring': {
                    '0%': { transform: 'scale(0.8)', opacity: '0.7' },
                    '70%': { transform: 'scale(2.2)', opacity: '0' },
                    '100%': { transform: 'scale(2.2)', opacity: '0' },
                },
                'caret-blink': {
                    '0%, 45%': { opacity: '1' },
                    '50%, 95%': { opacity: '0.15' },
                },
                'dash-flow': {
                    to: { strokeDashoffset: '-24' },
                },
                'dot-bounce': {
                    '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
                    '30%': { transform: 'translateY(-4px)', opacity: '1' },
                },
                'spin-slow': {
                    to: { transform: 'rotate(360deg)' },
                },
            },
            animation: {
                marquee: 'marquee 42s linear infinite',
                shimmer: 'shimmer 1.6s infinite',
                'fade-up': 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
                'fade-in': 'fade-in 0.4s ease both',
                'scale-in': 'scale-in 0.24s cubic-bezier(0.16,1,0.3,1) both',
                'slide-in-right': 'slide-in-right 0.32s cubic-bezier(0.16,1,0.3,1) both',
                'slide-in-left': 'slide-in-left 0.32s cubic-bezier(0.16,1,0.3,1) both',
                'pulse-ring': 'pulse-ring 2.6s cubic-bezier(0.16,1,0.3,1) infinite',
                'caret-blink': 'caret-blink 1.1s steps(1) infinite',
                'dash-flow': 'dash-flow 1.4s linear infinite',
                'spin-slow': 'spin-slow 14s linear infinite',
            },
        },
    },
    plugins: [],
};
