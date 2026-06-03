import { type KcalDay, type Kg, type UserProfile, kcalDay } from "./types";
import { type Composition } from "./bodyComposition";
import { restingEnergy } from "./restingEnergy";

/**
 * Physical Activity Level (PAL) tiers for the cold-start TDEE prior.
 *
 * Before the engine has any logged weeks, it cannot infer TDEE from
 * energy balance — it has to *estimate* total expenditure from BMR. The
 * scientifically standard way to do that is BMR × an activity factor.
 *
 * The factors below are the widely-published Harris–Benedict activity
 * multipliers, which are consistent with the Physical Activity Level
 * (PAL) categories in the FAO/WHO/UNU 2001 expert report and the US
 * Institute of Medicine DRI. They are population averages, not
 * individual truths — which is exactly why they are only used to seed
 * the prior. Every Monday the Bayesian update (see `updateTdeePosterior`)
 * pulls the estimate toward the user's *measured* expenditure, so any
 * error in the seed decays within a few weeks of real logging.
 *
 * For the resting-energy term we prefer Katch–McArdle when the user has
 * logged a *measured* body composition (tape via the U.S. Navy formula,
 * or a direct DEXA/smart-scale %BF), since lean mass predicts RMR more
 * accurately. Absent that measurement we fall back to Mifflin–St Jeor —
 * we never ask the user to *guess* a body-fat number, which would inject
 * more error than it removes. That model choice lives in `restingEnergy`.
 */
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very"
  | "extra";

export const PAL_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,   // desk job, little or no exercise
  light:     1.375, // light exercise 1–3 days/week
  moderate:  1.55,  // moderate exercise 3–5 days/week
  very:      1.725, // hard exercise 6–7 days/week
  extra:     1.9,   // physical job + hard daily training
};

/** Ordered for UI rendering, with self-describing copy. */
export const ACTIVITY_LEVELS: readonly {
  key: ActivityLevel;
  label: string;
  detail: string;
  factor: number;
}[] = [
  { key: "sedentary", label: "Sedentary",   detail: "Desk job · little or no exercise",     factor: PAL_FACTORS.sedentary },
  { key: "light",     label: "Light",        detail: "Light exercise · 1–3 days / week",     factor: PAL_FACTORS.light },
  { key: "moderate",  label: "Moderate",     detail: "Moderate exercise · 3–5 days / week",  factor: PAL_FACTORS.moderate },
  { key: "very",      label: "Very Active",  detail: "Hard exercise · 6–7 days / week",      factor: PAL_FACTORS.very },
  { key: "extra",     label: "Extra Active", detail: "Physical job + hard daily training",   factor: PAL_FACTORS.extra },
];

/** The factor used when no activity level has been recorded yet. */
export const DEFAULT_ACTIVITY_LEVEL: ActivityLevel = "moderate";

export const palFactor = (level: ActivityLevel): number => PAL_FACTORS[level];

/**
 * Cold-start TDEE prior: `RMR × PAL`. Always pass *trend weight* (EWMA),
 * not a single noisy scale reading, so the seed matches the weight basis
 * the weekly engine uses. When a measured `composition` is supplied the
 * RMR term uses Katch–McArdle; otherwise Mifflin–St Jeor.
 *
 * This is only the prior. Once weeks of logs exist, the live derivation
 * walks the Bayesian update from this seed forward, so its long-run
 * influence fades — but a lifestyle-matched seed means the *first* week's
 * target is meaningfully closer to truth than a one-size-fits-all guess.
 */
export const seedTdee = (
  profile: UserProfile,
  trendWeight: Kg,
  level: ActivityLevel = DEFAULT_ACTIVITY_LEVEL,
  composition?: Composition | null,
): KcalDay => kcalDay(restingEnergy(profile, trendWeight, composition) * palFactor(level));
