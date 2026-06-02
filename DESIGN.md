# Dense Matrix — Design System

The single source of truth for every UI surface in Dynamic Energy Tracker (iOS app, Next.js web, OS widgets, marketing site). Reference prototypes live at:

`~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/6f3f8565-9754-45a5-be7c-0afe91b124f2`

## Philosophy

**The interface is an instrument, not a dashboard.** Users come to read precise telemetry about their own metabolism — calories, mass, energy flux, engine convergence. Every pixel earns its place by either *carrying data* or *framing data*. Decoration is banned. Numbers are protagonists; chrome is hairline-thin.

Voice is **tactical / mission-critical**: COMMAND, CONVERGENCE, BAYESIAN AUDIT, ENERGY FLUX RUNWAY, SYNC FREQUENCY. Never cute, never gamified, never "you got this!". The product earns trust by sounding like a flight computer.

## Core principles

1. **Hairlines, not borders.** All dividers are `0.5px solid var(--border)`. Never 1px+, never rounded boxes-within-boxes.
2. **Sharp geometry.** Radii are `2px` or `4px`. Pills and large radii are reserved for iOS-native elements (status bar, dynamic island).
3. **Mono for numerals, always.** Every number uses `--font-mono` with `font-variant-numeric: tabular-nums`. SF Pro Display only for headings; SF Pro Text for prose.
4. **Eyebrows over titles.** Section labels are 10–12px mono uppercase, `letter-spacing: 0.1em+`, colored `--accent` for emphasis or `--muted` otherwise. The "real" title sits below.
5. **One accent.** Tactical Amber `oklch(70% 0.18 50)` is the only color besides the neutral ramp. Use it sparingly — a single amber number per panel reads as a signal; ten reads as noise.
6. **Soft tokens via `color-mix`.** Use `--accent-soft` and `--fg-soft` for fills and tracks instead of opacity classes.
7. **Grids built from gaps.** Cell grids use `gap: 1px; background: var(--border)` so the border *is* the gap. No double-stroked tables.
8. **Motion is mechanical.** Transitions ≤150ms. `:active` states scale to `0.96` and swap to `--accent-soft`. No spring bounces, no fade-in-up hero animations.

## Tokens

Single set, used across all surfaces. iOS prototypes and the web app must read from the same names.

```css
:root {
  /* Color (oklch — perceptually uniform) */
  --bg:           oklch(12% 0.01  260);   /* Obsidian */
  --surface:      oklch(16% 0.015 260);
  --fg:           oklch(95% 0.005 260);
  --muted:        oklch(45% 0.01  260);
  --border:       oklch(22% 0.02  260);
  --accent:       oklch(70% 0.18  50);    /* Tactical Amber */

  --accent-soft:  color-mix(in oklch, var(--accent) 12%, transparent);
  --fg-soft:      color-mix(in oklch, var(--fg)      5%, transparent);

  /* Type */
  --font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
  --font-body:    -apple-system, BlinkMacSystemFont, 'SF Pro Text',    system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;

  /* Display scale (web/marketing) */
  --fs-h1:   clamp(48px, 8vw, 96px);
  --fs-h2:   clamp(32px, 4vw, 56px);
  --fs-h3:   24px;
  --fs-lead: 20px;
  --fs-body: 16px;
  --fs-meta: 12px;

  /* Mobile big number */
  --fs-bignum: 32px;

  /* Geometry */
  --radius:        2px;
  --radius-card:   4px;
  --hairline:      0.5px solid var(--border);

  /* Rhythm */
  --gap-xs: 4px;
  --gap-sm: 8px;
  --gap-md: 16px;
  --gap-lg: 40px;
  --gap-xl: 80px;
  --container: 1200px;
}
```

## Typographic utilities

```css
.num     { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.meta    { font-family: var(--font-mono); font-size: 10px; color: var(--muted);
           text-transform: uppercase; letter-spacing: 0.1em; }
.eyebrow { font-family: var(--font-mono); font-size: 11px; color: var(--accent);
           text-transform: uppercase; letter-spacing: 0.2em; }
.h1, h1  { font-family: var(--font-display); font-weight: 800;
           letter-spacing: -0.05em; line-height: 0.95; }
.h2, h2  { font-family: var(--font-display); font-weight: 800;
           letter-spacing: -0.03em; line-height: 1.0; }
.big-num { font-size: var(--fs-bignum); font-weight: 800;
           letter-spacing: -0.05em; line-height: 1; }
```

## Recurring components

- **Runway track** — horizontal bar with `--fg-soft` background, `--accent` fill, optional 45° hatching overlay (`repeating-linear-gradient`), vertical target line glowing in `--accent`.
- **Telemetry grid** — `grid-template-columns: repeat(2, 1fr); gap: 1px; background: var(--border);` cells are `var(--bg)` with 16px padding.
- **Sparkline** — flex row of 2px-gap bars; inactive `--fg-soft`, active `--accent`. Height ≤24px.
- **Dot-grid graph** — surface card with `background-image` of two thin `--border` lines at 20px intervals, 0.3 opacity.
- **Action shelf** — fixed bottom row, `backdrop-filter: blur(20px)`, `background: color-mix(in oklch, var(--bg) 95%, transparent)`, hairline top border, square tiles aspect-ratio 1, `:active` scales to 0.96.
- **Status bar / dynamic island** — present on every iOS screen; never decorate them.

## Surface map

| Surface | File | Purpose |
|---|---|---|
| iOS Command | `screens/matrix-home.html` | Daily telemetry, runway, micro-log shelf |
| iOS Matrix | `screens/matrix-activity.html` | 24h block sequencer |
| iOS Convergence | `screens/matrix-checkin.html` | Monday Bayesian audit |
| iOS Gallery | `index.html` | Project launcher (three iPhone frames) |
| Marketing | `landing.html` | Public site, "Convergence Engine" pitch |
| Web Console | `console.html` | Power-user analytics dashboard |
| Widgets | `widgets.html` | Dynamic Island + Live Activity specs |

When building a new surface, copy the `:root` block from any existing screen rather than re-deriving values. Drift between surfaces is the #1 thing this doc exists to prevent.

## Voice cheatsheet

| Use | Don't use |
|---|---|
| Energy Flux Runway | Daily calorie budget |
| Engine Confidence | Accuracy score |
| Convergence in 4.2 days | You're on track! |
| Sync Frequency · 1.2 Hz | Last synced 2 min ago |
| Mass / Fuel / Step / Scan | Weight / Food / Steps / Camera |
| Bayesian flux stable | Looking good 👍 |

## Engine ↔ UI contract

The engine package (`src/`) is framework-agnostic and emits raw numbers in SI units (kg, kcal, kcal/day). The UI is the only place where:

- Numbers are formatted (`tabular-nums`, comma grouping, no rounding below the engine's reported precision).
- Units are localized (kg↔lb, kcal↔kJ).
- Language is applied (the "Convergence" / "Flux" vocabulary above is a *UI* layer, not engine output).

The engine never returns strings meant for display.
