import { type KcalDay, type Kg, type UserProfile } from "./types";
import { type Composition, katchMcArdle } from "./bodyComposition";
import { mifflinStJeor } from "./bmr";

/**
 * Single decision point for resting energy (BMR/RMR).
 *
 * When a body-composition estimate is available we use Katch–McArdle off
 * lean mass — more accurate because it measures the metabolically active
 * tissue directly. Otherwise we fall back to Mifflin–St Jeor, the best
 * predictive equation from weight/height/age/sex alone.
 *
 * Every consumer (cold-start seed, live TDEE derivation, settings BMR
 * readout) calls this rather than the raw equations, so the choice of
 * model lives in exactly one place and the two runtimes can never drift.
 */
export const restingEnergy = (
  profile: UserProfile,
  trendWeight: Kg,
  composition?: Composition | null,
): KcalDay =>
  composition
    ? katchMcArdle(composition.leanMassKg)
    : mifflinStJeor(profile, trendWeight);
