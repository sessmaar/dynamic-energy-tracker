import {
  type KcalDay, type Kcal,
  KCAL_PER_KG_BODY_MASS, kcal, kcalDay,
} from "./types";

/**
 * A weekly weight-change goal in kg/week. Negative for cuts, positive
 * for gains, 0 for maintenance. We allow the full real number line — the
 * UI is responsible for warning the user before storing values that
 * imply unsafe deficits.
 */
export interface WeeklyGoal {
  readonly kgPerWeek: number;
}

/**
 * Daily calorie target derived from an inferred TDEE and a weekly goal.
 *
 *   weeklyEnergyDelta = kgPerWeek · 7700
 *   dailyTarget       = TDEE + weeklyEnergyDelta / 7
 *
 * Returned in kcal/day. A negative goal lowers the target below TDEE
 * (cut); a positive goal raises it (gain).
 */
export const dailyTargetFromTdee = (tdee: KcalDay, goal: WeeklyGoal): KcalDay => {
  const dailyDelta = (goal.kgPerWeek * KCAL_PER_KG_BODY_MASS) / 7;
  return kcalDay(tdee + dailyDelta);
};

/**
 * Distribute a daily-average calorie target across a 7-day week, raising
 * training days and lowering rest days by `trainingDayBoostPct` while
 * keeping the weekly sum exactly equal to `avgTarget · 7`.
 *
 * `isTrainingDay` is indexed by day-of-week starting Monday (0 = Mon).
 *
 * If every day or no day is a training day, the boost has nothing to
 * trade against, so all days return the average target unchanged.
 */
export const distributeWeeklyTarget = (
  avgTarget: KcalDay,
  isTrainingDay: readonly boolean[],
  trainingDayBoostPct = 0.10,
): readonly KcalDay[] => {
  if (isTrainingDay.length !== 7) throw new RangeError("isTrainingDay must have length 7");
  if (trainingDayBoostPct < 0 || trainingDayBoostPct >= 1) {
    throw new RangeError(`trainingDayBoostPct must be in [0,1), got ${trainingDayBoostPct}`);
  }
  const trainingCount = isTrainingDay.filter(Boolean).length;
  const restCount = 7 - trainingCount;
  if (trainingCount === 0 || restCount === 0) {
    return Array.from({ length: 7 }, () => avgTarget);
  }
  const weekTotal = avgTarget * 7;
  const trainingCal = avgTarget * (1 + trainingDayBoostPct);
  // Solve for rest-day calories so the weekly sum is preserved exactly.
  const restCal = (weekTotal - trainingCount * trainingCal) / restCount;
  return isTrainingDay.map((t) => kcalDay(t ? trainingCal : restCal));
};

/**
 * Activity-credit adjustment for a *single day*.
 *
 *   adjusted = base + creditFraction · max(actualActive - plannedActive, 0)
 *
 * Only *extra* activity beyond plan grants credit, and only a fraction
 * of it (default 60%) so the weekly deficit is preserved in expectation.
 * Returning fewer calories than the base is intentionally disallowed
 * here — under-shooting plan should not silently tighten the day's
 * target; that's a UX decision for the check-in screen, not this layer.
 */
export const dailyTargetWithActivityCredit = (
  baseTarget: KcalDay,
  plannedActiveCal: Kcal,
  actualActiveCal: Kcal,
  creditFraction = 0.6,
): KcalDay => {
  if (creditFraction < 0 || creditFraction > 1) {
    throw new RangeError(`creditFraction must be in [0,1], got ${creditFraction}`);
  }
  const surplus = Math.max(actualActiveCal - plannedActiveCal, 0);
  return kcalDay(baseTarget + creditFraction * surplus);
};

/** Convert a kg/week goal to its weekly kcal delta. Useful for UI explainers. */
export const weeklyEnergyDelta = (goal: WeeklyGoal): Kcal =>
  kcal(goal.kgPerWeek * KCAL_PER_KG_BODY_MASS);
