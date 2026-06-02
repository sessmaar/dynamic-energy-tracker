/**
 * Hand-rolled SVG line chart. Keeps the bundle small and lets the
 * Dense Matrix aesthetic (hairlines, dot grid, amber glow) be expressed
 * in pure CSS variables — no charting-library opinions to fight.
 */
export interface LineChartProps {
  /** Sequence of {x, y} where x is a 0..1 normalized position. */
  series: ReadonlyArray<{ x: number; y: number }>;
  /** Optional secondary series, drawn as scatter dots in muted color. */
  scatter?: ReadonlyArray<{ x: number; y: number }>;
  /** y-axis domain. If omitted, derived from series. */
  yMin?: number;
  yMax?: number;
  /** Render height in CSS pixels (intrinsic; SVG scales via preserveAspectRatio="none"). */
  height?: number;
  /** Optional axis labels (top/bottom of y-range, start/end of x-range). */
  yTopLabel?: string;
  yBottomLabel?: string;
  xStartLabel?: string;
  xEndLabel?: string;
}

export const LineChart = ({
  series,
  scatter,
  yMin,
  yMax,
  height = 220,
  yTopLabel,
  yBottomLabel,
  xStartLabel,
  xEndLabel,
}: LineChartProps) => {
  const all = scatter ? [...series, ...scatter] : series;
  const lo = yMin ?? Math.min(...all.map((p) => p.y));
  const hi = yMax ?? Math.max(...all.map((p) => p.y));
  const span = hi - lo || 1;

  const W = 1000;
  const H = 320;
  const pad = 12;

  const project = (p: { x: number; y: number }) => ({
    cx: pad + p.x * (W - 2 * pad),
    cy: H - pad - ((p.y - lo) / span) * (H - 2 * pad),
  });

  const path = series
    .map((p, i) => {
      const { cx, cy } = project(p);
      return `${i === 0 ? "M" : "L"}${cx.toFixed(1)} ${cy.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div style={{ position: "relative", height }} className="dot-grid">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        {scatter?.map((p, i) => {
          const { cx, cy } = project(p);
          return <circle key={i} cx={cx} cy={cy} r="2" fill="var(--muted)" opacity="0.7" />;
        })}
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "drop-shadow(0 0 6px var(--accent-glow))" }}
        />
      </svg>

      {(yTopLabel || yBottomLabel || xStartLabel || xEndLabel) && (
        <>
          {yTopLabel && (
            <span className="meta" style={{ position: "absolute", top: 6, right: 8 }}>{yTopLabel}</span>
          )}
          {yBottomLabel && (
            <span className="meta" style={{ position: "absolute", bottom: 6, right: 8 }}>{yBottomLabel}</span>
          )}
          {xStartLabel && (
            <span className="meta" style={{ position: "absolute", bottom: 6, left: 8 }}>{xStartLabel}</span>
          )}
          {xEndLabel && (
            <span className="meta" style={{ position: "absolute", top: 6, left: 8 }}>{xEndLabel}</span>
          )}
        </>
      )}
    </div>
  );
};
