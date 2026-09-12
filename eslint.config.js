import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-server', 'node_modules', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Co-locating a hook with its provider (useAI, useCommandPalette, useToast)
      // is deliberate; the fast-refresh trade-off is worth the simpler API surface.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true, allowExportNames: [
        'useAI','useCommandPalette','useToast','useAuth','useTheme','useSmoothScroll','useChartSize',
        'gsap','ScrollTrigger','niceTicks','shortNumber','CHART_COLORS','statusTone',
      ] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['server/**/*.ts'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
