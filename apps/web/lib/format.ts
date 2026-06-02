export const round0 = (n: number): string => Math.round(n).toLocaleString();
export const round1 = (n: number): string => n.toFixed(1);
export const signed = (n: number, digits = 0): string => {
  const v = digits === 0 ? Math.round(n) : Number(n.toFixed(digits));
  return v > 0 ? `+${v.toLocaleString()}` : `${v.toLocaleString()}`;
};
export const pct = (u: number): string => `${Math.round(u * 100)}%`;
