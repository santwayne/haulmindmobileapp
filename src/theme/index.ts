// src/theme/index.ts
// Single entry-point — import everything from '@/theme' or '../../theme'

export { default as COLORS } from './colors';
export { FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT } from './typography';
export { SPACING, RADIUS } from './spacing';
export { SHADOWS } from './shadows';
export { getStatusStyle, getPriorityStyle, hexToRgba } from './helpers';
export type { StatusStyle, PriorityStyle } from './helpers';
export { default as globalStyles } from './globalStyles';
export { rs, rf, ri, isTablet, isLargeTablet, SCALE, screenWidth, screenHeight } from './responsive';
