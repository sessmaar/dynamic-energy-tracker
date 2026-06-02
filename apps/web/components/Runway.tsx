export interface RunwayProps {
  fillFraction: number;
  targetFraction?: number;
}

export const Runway = ({ fillFraction, targetFraction = 1 }: RunwayProps) => {
  const fill = Math.max(0, Math.min(1.2, fillFraction));
  const target = Math.max(0, Math.min(1, targetFraction));
  return (
    <div className="runway-track">
      <div className="runway-fill" style={{ width: `${fill * 100}%` }} />
      <div className="runway-target" style={{ left: `${target * 100}%` }} />
    </div>
  );
};
