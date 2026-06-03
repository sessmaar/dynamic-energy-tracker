import { type Cm, type Kg, type KcalDay, type Sex, type Unit, kcalDay, kg, unit } from "./types";

/**
 * Body-composition estimation from circumference measurements.
 *
 * The one scientifically validated way to estimate body fat from
 * self-reportable inputs (a tape measure) is the U.S. Navy circumference
 * method (Hodgdon & Beckett, 1984). It is what this module implements.
 * We deliberately do NOT estimate body fat from photos — no published
 * method maps an image to %BF with defensible accuracy, so photos in this
 * app are qualitative progress records only and feed no calculation.
 *
 * A measured %BF yields lean body mass, which in turn unlocks the
 * Katch–McArdle resting-energy equation (see `restingEnergy.ts`). That
 * equation is more accurate than Mifflin–St Jeor *when lean mass is
 * known* — the missing ingredient was a trustworthy body-fat number,
 * which a tape measurement provides.
 *
 * Note on language: we report *lean body mass*, not "muscle mass". A tape
 * measure cannot separate skeletal muscle from bone, organs, and water;
 * LBM is the honest quantity.
 */

/** A point-in-time composition estimate. `bodyFatPct` is a fraction 0..1. */
export interface Composition {
  readonly bodyFatPct: Unit;
  readonly leanMassKg: Kg;
}

const log10 = (n: number): number => Math.log(n) / Math.LN10;

/** Plausible human body-fat band; results outside it signal bad inputs. */
const MIN_BODY_FAT_PCT = 0.03;
const MAX_BODY_FAT_PCT = 0.60;

/**
 * U.S. Navy body-fat percentage (metric inputs, cm). Returns a fraction
 * in [0,1], clamped to the physiological band above.
 *
 *   men:   495 / (1.0324 − 0.19077·log10(waist−neck) + 0.15456·log10(height)) − 450
 *   women: 495 / (1.29579 − 0.35004·log10(waist+hip−neck) + 0.22100·log10(height)) − 450
 *
 * Women require a hip measurement. Waist must exceed neck (men) or
 * waist+hip must exceed neck (women), otherwise the log is undefined and
 * we throw rather than return a nonsense number.
 */
export const navyBodyFatPct = (
  sex: Sex,
  heightCm: Cm,
  neckCm: Cm,
  waistCm: Cm,
  hipCm?: Cm,
): Unit => {
  if (sex === "female" && (hipCm === undefined)) {
    throw new RangeError("navyBodyFatPct: hip measurement is required for female estimates");
  }

  let raw: number;
  if (sex === "male") {
    const girth = waistCm - neckCm;
    if (girth <= 0) throw new RangeError(`navyBodyFatPct: waist (${waistCm}) must exceed neck (${neckCm})`);
    raw = 495 / (1.0324 - 0.19077 * log10(girth) + 0.15456 * log10(heightCm)) - 450;
  } else {
    const girth = waistCm + (hipCm as number) - neckCm;
    if (girth <= 0) throw new RangeError(`navyBodyFatPct: waist+hip must exceed neck`);
    raw = 495 / (1.29579 - 0.35004 * log10(girth) + 0.22100 * log10(heightCm)) - 450;
  }

  const fraction = raw / 100;
  const clamped = Math.min(Math.max(fraction, MIN_BODY_FAT_PCT), MAX_BODY_FAT_PCT);
  return unit(clamped);
};

/** Lean body mass = weight × (1 − bodyFat). */
export const leanMass = (weight: Kg, bodyFatPct: Unit): Kg => kg(weight * (1 - bodyFatPct));

/**
 * Katch–McArdle resting metabolic rate: `370 + 21.6 · LBM(kg)`. Unlike
 * Mifflin–St Jeor it ignores sex/age/height because lean mass already
 * captures the metabolically active tissue directly.
 */
export const katchMcArdle = (leanMassKg: Kg): KcalDay => kcalDay(370 + 21.6 * leanMassKg);

/**
 * Build a `Composition` from a weight plus either a directly-measured
 * body-fat fraction (DEXA, smart scale, calipers) or a Navy estimate.
 * Direct measurement wins when supplied — it is more accurate than the
 * tape estimate.
 */
export const compositionFrom = (
  weight: Kg,
  bodyFatPct: Unit,
): Composition => ({
  bodyFatPct,
  leanMassKg: leanMass(weight, bodyFatPct),
});

/**
 * Inputs for resolving a single assessment into a `Composition`. A
 * directly measured `directBodyFatPct` (DEXA / smart scale / calipers)
 * takes precedence; otherwise we fall back to the Navy estimate from
 * circumferences. `weightKg` is the body weight the lean mass is computed
 * against — pass the trend weight, not a noisy single reading.
 */
export interface CompositionInputs {
  readonly sex: Sex;
  readonly heightCm: Cm;
  readonly weightKg: Kg;
  readonly neckCm?: Cm;
  readonly waistCm?: Cm;
  readonly hipCm?: Cm;
  readonly directBodyFatPct?: Unit;
}

/**
 * Resolve assessment inputs into a `Composition`, or `null` when there
 * isn't enough data (no direct %BF and incomplete circumferences). Women
 * need a hip measurement for the Navy estimate; without it we return null
 * rather than throw, so callers can degrade gracefully to Mifflin–St Jeor.
 */
export const resolveComposition = (i: CompositionInputs): Composition | null => {
  if (i.directBodyFatPct !== undefined) return compositionFrom(i.weightKg, i.directBodyFatPct);

  const hasTape =
    i.neckCm !== undefined && i.waistCm !== undefined &&
    (i.sex === "male" || i.hipCm !== undefined);
  if (!hasTape) return null;

  const bf = navyBodyFatPct(i.sex, i.heightCm, i.neckCm as Cm, i.waistCm as Cm, i.hipCm);
  return compositionFrom(i.weightKg, bf);
};
