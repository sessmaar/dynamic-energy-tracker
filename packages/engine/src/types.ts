/**
 * Branded numeric types. All engine math is metric-internal:
 *   mass = kg, height = cm, energy = kcal, time = hours/minutes/days.
 *
 * Brands are erased at runtime — they exist only to keep a caller from
 * passing pounds where kilograms are expected. Construct with the
 * helpers (`kg(70)`, `kcal(2400)`, ...); never cast directly.
 */

type Brand<T, B extends string> = T & { readonly __brand: B };

export type Kg      = Brand<number, "Kg">;
export type Cm      = Brand<number, "Cm">;
export type Years   = Brand<number, "Years">;
export type Kcal    = Brand<number, "Kcal">;
export type KcalDay = Brand<number, "KcalDay">;
export type Hours   = Brand<number, "Hours">;
export type Minutes = Brand<number, "Minutes">;
export type Met     = Brand<number, "Met">;
/** 0..1, e.g. weighting on a Bayesian update or data completeness. */
export type Unit    = Brand<number, "Unit">;

const finite = (n: number, label: string): void => {
  if (!Number.isFinite(n)) throw new RangeError(`${label} must be finite, got ${n}`);
};
const positive = (n: number, label: string): void => {
  finite(n, label);
  if (n <= 0) throw new RangeError(`${label} must be > 0, got ${n}`);
};
const nonNeg = (n: number, label: string): void => {
  finite(n, label);
  if (n < 0) throw new RangeError(`${label} must be >= 0, got ${n}`);
};
const inUnit = (n: number, label: string): void => {
  finite(n, label);
  if (n < 0 || n > 1) throw new RangeError(`${label} must be in [0,1], got ${n}`);
};

export const kg      = (n: number): Kg      => { positive(n, "kg");      return n as Kg; };
export const cm      = (n: number): Cm      => { positive(n, "cm");      return n as Cm; };
export const years   = (n: number): Years   => { nonNeg(n, "years");     return n as Years; };
export const kcal    = (n: number): Kcal    => { finite(n, "kcal");      return n as Kcal; };
export const kcalDay = (n: number): KcalDay => { finite(n, "kcalDay");   return n as KcalDay; };
export const hours   = (n: number): Hours   => { nonNeg(n, "hours");     return n as Hours; };
export const minutes = (n: number): Minutes => { nonNeg(n, "minutes");   return n as Minutes; };
export const met     = (n: number): Met     => { positive(n, "met");     return n as Met; };
export const unit    = (n: number): Unit    => { inUnit(n, "unit");      return n as Unit; };

export const minutesToHours = (m: Minutes): Hours => (m / 60) as Hours;

export type Sex = "male" | "female";

export type GoalType = "cut" | "maintain" | "gain";

/** ISO date `YYYY-MM-DD`. Validated at boundary, not branded — strings are checked by `isoDate()`. */
export type IsoDate = string;

export const isoDate = (s: string): IsoDate => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new RangeError(`isoDate expects YYYY-MM-DD, got ${s}`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new RangeError(`isoDate invalid: ${s}`);
  return s;
};

/**
 * Energy density constants (kcal per kg).
 *
 * Adipose (7700) is the old standard. 2024-2025 research (Hall et al.)
 * suggests total body mass flux follows a mixed density due to lean mass
 * loss (~25 % lean loss "Quarter FFM Rule" in standard dieting).
 */
export const KCAL_PER_KG_ADIPOSE = 7700;

/**
 * Default mixed-flux density (assuming ~25 % lean loss).
 * Calculated as: 0.75 * 7700 + 0.25 * 1100 ≈ 6050.
 * We use 6200 as a conservative evidence-based midpoint for tracking.
 */
export const KCAL_PER_KG_MIXED_FLUX = 6200;

/** Default fallback if no specific context is available. */
export const KCAL_PER_KG_BODY_MASS = KCAL_PER_KG_MIXED_FLUX;

export interface UserProfile {
  readonly sex: Sex;
  readonly age: Years;
  readonly heightCm: Cm;
}

export interface WeightEntry {
  readonly date: IsoDate;
  readonly weight: Kg;
}

export interface IntakeEntry {
  readonly date: IsoDate;
  readonly calories: Kcal;
  readonly carbsG?: number | null;
  readonly proteinG?: number | null;
  readonly fatG?: number | null;
}

export interface ActivityBlock {
  readonly date: IsoDate;
  readonly met: Met;
  readonly durationMinutes: Minutes;
}
