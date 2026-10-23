// src/theme/globalStyles.ts
// Pre-built StyleSheet objects for common patterns — import and spread into any screen.
// Mirrors the CSS utility classes in the web frontend (index.css).

import { StyleSheet } from 'react-native';
import COLORS from './colors';
import { FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT } from './typography';
import { SPACING, RADIUS } from './spacing';

export const globalStyles = StyleSheet.create({

  // ─── Screen / Layout ────────────────────────────────────────────────────────
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING['2xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Cards ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  cardPremium: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    // shadow applied separately via SHADOWS from shadows.ts
  },
  cardLight: {
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },

  // ─── Typography ──────────────────────────────────────────────────────────────
  heading: {
    fontSize: FONT_SIZE['2xl'],
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textHeading,
    lineHeight: LINE_HEIGHT.loose,
  },
  subheading: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    lineHeight: LINE_HEIGHT.relaxed,
  },
  bodyText: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.normal,
    color: COLORS.textPrimary,
    lineHeight: LINE_HEIGHT.normal,
  },
  secondaryText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.normal,
    color: COLORS.textSecondary,
    lineHeight: LINE_HEIGHT.snug,
  },
  labelText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  neonBlue: {
    color: COLORS.accentBlue,
  },
  neonGreen: {
    color: COLORS.accentGreen,
  },

  // ─── Buttons ─────────────────────────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: COLORS.accentBlue,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.black,
  },
  btnOutline: {
    backgroundColor: COLORS.transparent,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentBlue,
  },
  btnDanger: {
    backgroundColor: COLORS.accentRed,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDangerText: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
  },

  // ─── Badges / Status Pills ────────────────────────────────────────────────────
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'capitalize',
  },

  // ─── Status Dot ──────────────────────────────────────────────────────────────
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
  },
  statusDotActive: {
    backgroundColor: COLORS.accentGreen,
  },
  statusDotInactive: {
    backgroundColor: COLORS.accentRed,
  },

  // ─── Divider ──────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: SPACING.md,
  },

  // ─── Input ────────────────────────────────────────────────────────────────────
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.accentBlue,
  },

  // ─── Section Header ────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentNavyBlue,
  },
  viewAllText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accentBlue,
    fontWeight: FONT_WEIGHT.medium,
  },

  // ─── Loading ──────────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgMain,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
  },

  // ─── Empty State ──────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['2xl'],
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: LINE_HEIGHT.normal,
  },

  // ─── Progress Bar ─────────────────────────────────────────────────────────────
  progressTrack: {
    height: 3,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,209,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentBlue,
  },
});

export default globalStyles;
