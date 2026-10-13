/**
 * Plan-specific Dashboard Color Themes (spec §115, R6).
 *
 * Each subscription tier grants curated theme aesthetics:
 * - LEAD (₹7,500): Basic / Premium
 * - CONVERT (₹15,000): Apple / Premium
 * - AUTOPILOT (₹30,000): Cream White / Cream Peach / Cream Burberry
 */

export type PlanTier = 'lead' | 'convert' | 'autopilot';

export interface ThemePalette {
  canvas: string;
  surface: string;
  elevated?: string;
  border: string;
  brand: string;
  accent: string;
  text: string;
  textMuted: string;
}

export interface DashboardTheme {
  id: string;
  name: string;
  planTier: PlanTier;
  description: string;
  previewColor: string;
  accentColor: string;
  palette: ThemePalette;
  tags: string[];
  isDefault?: boolean;
}

export const DASHBOARD_THEMES: DashboardTheme[] = [
  // ── LEAD (₹7,500/mo) ──────────────────────────────────────────
  {
    id: 'lead-basic',
    name: 'Basic',
    planTier: 'lead',
    description: 'Clean slate & modern indigo with high-contrast clarity.',
    previewColor: '#3b82f6',
    accentColor: '#6366f1',
    palette: {
      canvas: '248 250 252',
      surface: '255 255 255',
      elevated: '241 245 249',
      border: '226 232 240',
      brand: '59 130 246',
      accent: '99 102 241',
      text: '15 23 42',
      textMuted: '100 116 139',
    },
    tags: ['Standard', 'Clarity', 'High-contrast'],
    isDefault: true,
  },
  {
    id: 'lead-premium',
    name: 'Premium',
    planTier: 'lead',
    description: 'Executive charcoal slate with electric steel cyan accents.',
    previewColor: '#06b6d4',
    accentColor: '#0284c7',
    palette: {
      canvas: '241 245 249',
      surface: '255 255 255',
      elevated: '226 232 240',
      border: '203 213 225',
      brand: '6 182 212',
      accent: '2 132 199',
      text: '15 23 42',
      textMuted: '71 85 105',
    },
    tags: ['Executive', 'Steel Cyan', 'Charcoal'],
  },

  // ── CONVERT (₹15,000/mo) ──────────────────────────────────────
  {
    id: 'convert-apple',
    name: 'Apple',
    planTier: 'convert',
    description: 'Frosted silver glass with minimalist monochrome typography.',
    previewColor: '#0071e3',
    accentColor: '#86868b',
    palette: {
      canvas: '245 245 247',
      surface: '255 255 255',
      elevated: '238 238 240',
      border: '210 210 215',
      brand: '0 113 227',
      accent: '134 134 139',
      text: '29 29 31',
      textMuted: '110 110 115',
    },
    tags: ['Cupertino', 'Frosted Silver', 'Minimalist'],
    isDefault: true,
  },
  {
    id: 'convert-premium',
    name: 'Premium',
    planTier: 'convert',
    description: 'Deep midnight obsidian with vivid sapphire signal accents.',
    previewColor: '#4f46e5',
    accentColor: '#818cf8',
    palette: {
      canvas: '243 244 246',
      surface: '255 255 255',
      elevated: '229 231 235',
      border: '209 213 219',
      brand: '79 70 229',
      accent: '129 140 248',
      text: '17 24 39',
      textMuted: '107 114 128',
    },
    tags: ['Sapphire', 'Obsidian', 'Deep Contrast'],
  },

  // ── AUTOPILOT (₹30,000/mo) ────────────────────────────────────
  {
    id: 'autopilot-cream-white',
    name: 'Cream White',
    planTier: 'autopilot',
    description: 'Luxurious warm ivory and linen paper finish with rich ink typography.',
    previewColor: '#b45309',
    accentColor: '#d97706',
    palette: {
      canvas: '254 252 246',
      surface: '255 255 255',
      elevated: '248 244 234',
      border: '243 238 226',
      brand: '180 83 9',
      accent: '217 119 6',
      text: '41 37 36',
      textMuted: '120 113 108',
    },
    tags: ['Warm Linen', 'Ivory', 'Signature'],
    isDefault: true,
  },
  {
    id: 'autopilot-cream-peach',
    name: 'Cream Peach',
    planTier: 'autopilot',
    description: 'Warm terracotta peach finish with soft rose-gold undertones.',
    previewColor: '#ea580c',
    accentColor: '#f97316',
    palette: {
      canvas: '255 247 242',
      surface: '255 255 255',
      elevated: '255 238 230',
      border: '254 226 213',
      brand: '234 88 12',
      accent: '249 115 22',
      text: '41 37 36',
      textMuted: '124 111 106',
    },
    tags: ['Terracotta', 'Peach', 'Rose-Gold'],
  },
  {
    id: 'autopilot-cream-burberry',
    name: 'Cream Burberry',
    planTier: 'autopilot',
    description: 'Signature Burberry camel/khaki beige with refined black and vermilion accents.',
    previewColor: '#c29b38',
    accentColor: '#b91c1c',
    palette: {
      canvas: '252 249 242',
      surface: '255 255 255',
      elevated: '244 238 224',
      border: '236 228 210',
      brand: '194 155 56',
      accent: '185 28 28',
      text: '28 25 23',
      textMuted: '120 113 108',
    },
    tags: ['Burberry Camel', 'Beige', 'Haute Couture'],
  },
];

/** Normalizes plan slug or id into valid plan tier */
export function normalizePlanTier(planSlugOrId: string | null | undefined): PlanTier {
  if (!planSlugOrId) return 'lead';
  const clean = planSlugOrId.toLowerCase().replace(/^plan_/, '');
  if (clean === 'autopilot') return 'autopilot';
  if (clean === 'convert') return 'convert';
  return 'lead';
}

/** Get available theme options for a given plan */
export function getThemesForPlan(planSlugOrId: string | null | undefined): DashboardTheme[] {
  const tier = normalizePlanTier(planSlugOrId);
  return DASHBOARD_THEMES.filter((theme) => theme.planTier === tier);
}

/** Lookup a theme by its unique id */
export function getThemeById(themeId: string | null | undefined): DashboardTheme | undefined {
  if (!themeId) return undefined;
  return DASHBOARD_THEMES.find((theme) => theme.id === themeId);
}

/** Get default theme for a plan */
export function getDefaultThemeForPlan(planSlugOrId: string | null | undefined): DashboardTheme {
  const tier = normalizePlanTier(planSlugOrId);
  const themes = DASHBOARD_THEMES.filter((theme) => theme.planTier === tier);
  return themes.find((t) => t.isDefault) ?? themes[0]!;
}

/** Validates whether a theme is allowed on a plan */
export function isValidThemeForPlan(themeId: string, planSlugOrId: string | null | undefined): boolean {
  const tier = normalizePlanTier(planSlugOrId);
  const theme = getThemeById(themeId);
  return Boolean(theme && theme.planTier === tier);
}
