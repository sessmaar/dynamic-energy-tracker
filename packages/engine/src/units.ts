/**
 * Unit conversion helpers. The engine and the database both store
 * metric (kg, cm, kcal); the UI is the only layer that ever sees
 * imperial values. Putting the math here, not in a screen file,
 * keeps rounding consistent across mobile + web and makes it
 * testable in isolation.
 */

export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

export const cmToInches = (cm: number): number => cm / CM_PER_INCH;
export const inchesToCm = (inches: number): number => inches * CM_PER_INCH;

/** Convert cm → "5' 11" (ft + remaining inches, rounded to nearest inch). */
export const cmToFtIn = (cm: number): { feet: number; inches: number } => {
  const totalInches = Math.round(cmToInches(cm));
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
};

export const ftInToCm = (feet: number, inches: number): number =>
  inchesToCm(feet * 12 + inches);
