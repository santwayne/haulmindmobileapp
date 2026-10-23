// src/theme/typography.ts
// Font scale used across all screens — matches web heading/body hierarchy

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
};

export const FONT_WEIGHT = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const LINE_HEIGHT = {
  tight: 16,
  snug: 20,
  normal: 22,
  relaxed: 24,
  loose: 28,
};
