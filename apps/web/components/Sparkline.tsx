export interface SparklineProps {
  /** 0..1 normalized bar heights. */
  values: readonly number[];
  /** Bars from this index onward render in accent color. */
  activeFrom?: number;
  height?: number;
}

export const Sparkline = ({ values, activeFrom = values.length, height = 28 }: SparklineProps) => (
  <div
    style={{
      display: "flex",
      gap: 2,
      alignItems: "flex-end",
      height,
    }}
  >
    {values.map((v, i) => (
      <div
        key={i}
        style={{
          flex: 1,
          height: `${Math.max(0, Math.min(1, v)) * 100}%`,
          background: i >= activeFrom ? "var(--accent)" : "var(--fg-soft)",
          borderRadius: 1,
        }}
      />
    ))}
  </div>
);
