// src/theme/shadows.ts
// React Native shadow props — mirroring the web box-shadow tokens

import { Platform } from 'react-native';

const shadow = (
  color: string,
  offset: { width: number; height: number },
  opacity: number,
  radius: number,
  elevation: number,
) =>
  Platform.select({
    ios: { shadowColor: color, shadowOffset: offset, shadowOpacity: opacity, shadowRadius: radius },
    android: { elevation },
  });

export const SHADOWS = {
  sm:      shadow('#000', { width: 0, height: 1 }, 0.08, 2,  2),
  md:      shadow('#000', { width: 0, height: 2 }, 0.12, 4,  4),
  lg:      shadow('#000', { width: 0, height: 4 }, 0.16, 8,  8),
  xl:      shadow('#000', { width: 0, height: 6 }, 0.20, 12, 12),
  // Neon glow variants (iOS only — elevation on Android)
  glow:    shadow('#00D1FF', { width: 0, height: 0 }, 0.30, 8,  4),
  glowSm:  shadow('#00D1FF', { width: 0, height: 0 }, 0.15, 4,  2),
  primary: shadow('#1183e0', { width: 0, height: 4 }, 0.35, 8,  6),
  danger:  shadow('#F43F5E', { width: 0, height: 4 }, 0.35, 8,  6),
  success: shadow('#00FFA3', { width: 0, height: 4 }, 0.30, 8,  6),
};
