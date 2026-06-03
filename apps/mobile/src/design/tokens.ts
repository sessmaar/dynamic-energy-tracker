/**
 * Navigator Light tokens, React Native edition.
 *
 * Palette: Material Design 3 light scheme — primary blue (#0058BC),
 * secondary cyan (#006875 / #00E3FD), warm-white surfaces, soft borders.
 * Matches the Stitch "Navigator Light" design system.
 */

export const colors = {
  bg:                  "#F8FAFC",
  surface:             "#FFFFFF",
  surfaceContainer:    "#ECEEF0",
  surfaceContainerLow: "#F2F4F6",
  fg:                  "#191C1E",
  muted:               "#414755",
  border:              "#C1C6D7",
  accent:              "#0058BC",
  accentSoft:          "rgba(0,88,188,0.10)",
  fgSoft:              "rgba(25,28,30,0.06)",
  secondary:           "#006875",
  secondaryContainer:  "#00E3FD",
  error:               "#BA1A1A",
  black:               "#000000",
} as const;

export const fonts = {
  display: "System",
  body:    "System",
  mono:    "Menlo",
} as const;

export const fontSize = {
  meta:    10,
  micro:   11,
  small:   12,
  body:    14,
  lead:    16,
  h3:      18,
  h2:      24,
  bignum:  32,
  hero:    48,
} as const;

export const fontWeight = {
  regular: "400",
  semi:    "600",
  bold:    "700",
  black:   "800",
} as const satisfies Record<string, "400" | "600" | "700" | "800">;

export const radius = {
  sharp: 8,
  card:  16,
  pill:  999,
} as const;

export const gap = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;

export const hairline = {
  width: 1,
  color: colors.border,
} as const;

export const letterSpacing = {
  tight:   0.5,
  wide:    1.6,
  wider:   2.2,
  display: -1.5,
} as const;
