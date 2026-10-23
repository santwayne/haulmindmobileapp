// src/theme/helpers.ts
// Utility helpers — mirrors getStatusColor / getPriorityColor from web theme/colors.ts

import COLORS from './colors';

export interface StatusStyle {
  bg: string;
  text: string;
  border: string;
}

export const getStatusStyle = (status: string): StatusStyle => {
  const map: Record<string, StatusStyle> = {
    active:           { bg: 'rgba(0,255,163,0.12)',  text: COLORS.accentGreen,  border: COLORS.accentGreen },
    completed:        { bg: 'rgba(0,255,163,0.12)',  text: COLORS.accentGreen,  border: COLORS.accentGreen },
    valid:            { bg: 'rgba(0,255,163,0.12)',  text: COLORS.accentGreen,  border: COLORS.accentGreen },
    resolved:         { bg: 'rgba(0,255,163,0.12)',  text: COLORS.accentGreen,  border: COLORS.accentGreen },

    pending:          { bg: 'rgba(245,158,11,0.15)', text: COLORS.accentOrange, border: COLORS.accentOrange },
    expiring:         { bg: 'rgba(245,158,11,0.15)', text: COLORS.accentOrange, border: COLORS.accentOrange },
    'follow-up':      { bg: 'rgba(245,158,11,0.15)', text: COLORS.accentOrange, border: COLORS.accentOrange },
    investigating:    { bg: 'rgba(245,158,11,0.15)', text: COLORS.accentOrange, border: COLORS.accentOrange },

    'in-progress':    { bg: 'rgba(0,209,255,0.12)',  text: COLORS.accentBlue,   border: COLORS.accentBlue },
    scheduled:        { bg: 'rgba(0,209,255,0.12)',  text: COLORS.accentBlue,   border: COLORS.accentBlue },
    coached:          { bg: 'rgba(0,209,255,0.12)',  text: COLORS.accentBlue,   border: COLORS.accentBlue },

    overdue:          { bg: 'rgba(244,63,94,0.15)',  text: COLORS.accentRed,    border: COLORS.accentRed },
    expired:          { bg: 'rgba(244,63,94,0.15)',  text: COLORS.accentRed,    border: COLORS.accentRed },
    critical:         { bg: 'rgba(244,63,94,0.15)',  text: COLORS.accentRed,    border: COLORS.accentRed },
    'action-required':{ bg: 'rgba(244,63,94,0.15)',  text: COLORS.accentRed,    border: COLORS.accentRed },

    draft:            { bg: 'rgba(139,155,180,0.12)',text: COLORS.textSecondary, border: COLORS.textSecondary },
    archived:         { bg: 'rgba(139,155,180,0.12)',text: COLORS.textSecondary, border: COLORS.textSecondary },
  };

  return map[status.toLowerCase()] ?? {
    bg: 'rgba(139,155,180,0.12)',
    text: COLORS.textSecondary,
    border: COLORS.textSecondary,
  };
};

export interface PriorityStyle {
  bg: string;
  text: string;
}

export const getPriorityStyle = (priority: string): PriorityStyle => {
  const map: Record<string, PriorityStyle> = {
    low:      { bg: COLORS.accentGreen,  text: COLORS.black },
    medium:   { bg: COLORS.accentOrange, text: COLORS.white },
    high:     { bg: '#F97316',           text: COLORS.white },
    critical: { bg: COLORS.accentRed,    text: COLORS.white },
  };

  return map[priority.toLowerCase()] ?? { bg: COLORS.statusNeutral, text: COLORS.white };
};

/** Convert a hex color to rgba string */
export const hexToRgba = (hex: string, alpha = 1): string => {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
