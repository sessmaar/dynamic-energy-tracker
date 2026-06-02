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
 * Energy content of 1 kg of body-mass change. The classic 7700 kcal/kg
 * figure assumes fat-only flux; it is a rough planning constant, not a
 * physiological law. Centralized here so every module agrees.
 */
export const KCAL_PER_KG_BODY_MASS = 7700;

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
}

export interface ActivityBlock {
  readonly date: IsoDate;
  readonly met: Met;
  readonly durationMinutes: Minutes;
}
