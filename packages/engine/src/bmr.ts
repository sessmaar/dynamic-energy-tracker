import { type Kg, type KcalDay, type UserProfile, kcalDay } from "./types";

/**
 * Mifflin–St Jeor REE. Inputs are validated by the branded constructors
 * upstream, so this function only does the math.
 *
 *   male:   10W + 6.25H - 5A + 5
 *   female: 10W + 6.25H - 5A - 161
 *
 * Always pass *trend weight* (EWMA), not a raw daily scale value, to
 * avoid recomputing BMR off a noisy single measurement.
 */
export const mifflinStJeor = (profile: UserProfile, trendWeight: Kg): KcalDay => {
  const base = 10 * trendWeight + 6.25 * profile.heightCm - 5 * profile.age;
  const sexOffset = profile.sex === "male" ? 5 : -161;
  return kcalDay(base + sexOffset);
};
