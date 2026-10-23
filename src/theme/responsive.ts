// src/theme/responsive.ts
// Responsive scaling utilities for phone → tablet adaptation
// Design base: iPhone 14 Pro (390pt wide)
// Supports: iPhone, iPad mini (768pt), iPad Pro 11" (~834pt), iPad Pro 12.9" (~1024pt)

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Device detection ────────────────────────────────────────────────────────
export const isTablet = SCREEN_WIDTH >= 768;
export const isLargeTablet = SCREEN_WIDTH >= 1024;
export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;

// ─── Scale factor ────────────────────────────────────────────────────────────
// Determined by screen width breakpoints
const getScaleFactor = (): number => {
  if (SCREEN_WIDTH >= 1100) return 1.75; // iPad Pro 12.9"
  if (SCREEN_WIDTH >= 900)  return 1.60; // iPad Pro 11"
  if (SCREEN_WIDTH >= 768)  return 1.45; // iPad mini
  return 1.0;                            // iPhone
};

export const SCALE = getScaleFactor();

// ─── Scale functions ─────────────────────────────────────────────────────────

/**
 * rs — Responsive Size (linear scale)
 * Use for: padding, margin, gap, height, width, border radius
 */
export const rs = (size: number): number => Math.round(size * SCALE);

/**
 * rf — Responsive Font (moderate scale — gentler than linear)
 * Use for: fontSize. factor=0.55 means fonts grow 55% as fast as layout.
 */
export const rf = (size: number, factor = 0.55): number =>
  Math.round(size + (rs(size) - size) * factor);

/**
 * ri — Responsive Icon (between font and layout scale)
 * Use for: Ionicons size prop, image dimensions
 */
export const ri = (size: number): number =>
  Math.round(size + (rs(size) - size) * 0.65);
