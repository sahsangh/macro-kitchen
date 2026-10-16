import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  cardAlt: '#EEF0F3',
  border: '#E3E6EA',
  text: '#0E1116',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  accent: '#10B981',
  accentText: '#FFFFFF',
  accentSoft: '#D1FAE5',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  warning: '#F59E0B',
  calories: '#10B981',
  protein: '#3B82F6',
  carbs: '#F59E0B',
  fat: '#EC4899',
  fiber: '#8B5CF6',
  track: '#E5E7EB',
};

export type Palette = typeof light;

const dark: Palette = {
  bg: '#0B0D10',
  card: '#16191E',
  cardAlt: '#1E2228',
  border: '#262B33',
  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  accent: '#34D399',
  accentText: '#04281C',
  accentSoft: '#0F3B2E',
  danger: '#F87171',
  dangerSoft: '#3B1717',
  warning: '#FBBF24',
  calories: '#34D399',
  protein: '#60A5FA',
  carbs: '#FBBF24',
  fat: '#F472B6',
  fiber: '#A78BFA',
  track: '#262B33',
};

export const Palettes = { light, dark };

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
