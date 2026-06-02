/**
 * Dense Matrix tokens, React Native edition.
 *
 * The CSS source of truth uses oklch + color-mix (see DESIGN.md and
 * src/design/tokens.css at repo root). React Native does not yet support
 * oklch or color-mix on iOS, so each value here is the sRGB hex
 * equivalent rounded to 8-bit. Keep this file in lockstep with
 * tokens.css — if the canonical hue/lightness changes, both files
 * update.
 */

export const colors = {
  bg:         "#0E1117", // oklch(12% .01  260)
  surface:    "#15191F", // oklch(16% .015 260)
  fg:         "#F0F1F3", // oklch(95% .005 260)
  muted:      "#5F6168", // oklch(45% .01  260)
  border:     "#1E2128", // oklch(22% .02  260)
  accent:     "#E08A3A", // oklch(70% .18  50)  — Tactical Amber
  accentSoft: "rgba(224,138,58,0.12)", // ≈ color-mix(in oklch, accent 12%, transparent)
  fgSoft:     "rgba(240,241,243,0.05)",
  black:      "#000000",
} as const;

export const fonts = {
  // iOS native — RN resolves "System" to SF Pro automatically.
  display: "System",
  body:    "System",
  // JetBrains Mono needs to be loaded via expo-font; until then,
  // ui-monospace falls back to SF Mono on iOS, which is close enough.
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
  sharp: 2,
  card:  4,
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
  width: 0.5,
  color: colors.border,
} as const;

export const letterSpacing = {
  /** Mono uppercase labels — `.meta`, `.eyebrow`. */
  tight:   0.5,
  wide:    1.6,
  wider:   2.2,
  /** Display headings — RN uses px deltas, not em. */
  display: -1.5,
} as const;
