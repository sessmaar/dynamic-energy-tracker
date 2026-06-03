export * from "./types";
export { localDateInTimezone, todayUtc, ageFromDob } from "./datetime";
export {
  KG_PER_LB, CM_PER_INCH,
  kgToLb, lbToKg, cmToInches, inchesToCm, cmToFtIn, ftInToCm,
} from "./units";
export { mifflinStJeor } from "./bmr";
export {
  type Composition, type CompositionInputs,
  navyBodyFatPct, leanMass, katchMcArdle, compositionFrom, resolveComposition,
} from "./bodyComposition";
export { restingEnergy } from "./restingEnergy";
export {
  type ActivityLevel,
  PAL_FACTORS, ACTIVITY_LEVELS, DEFAULT_ACTIVITY_LEVEL,
  palFactor, seedTdee,
} from "./activityLevel";
export {
  ACTIVITY_CATALOG, type ActivityKey,
  metFor, activeCalories, totalActiveCalories,
} from "./met";
export { ewmaTrend, latestTrendWeight } from "./trendWeight";
export {
  type WeeklyTdeeResult, type BayesianUpdateResult,
  computeWeeklyTdee, alphaForDaysWithBoth, updateTdeePosterior,
  daysBetweenInclusive,
} from "./tdee";
export {
  type WeeklyGoal,
  dailyTargetFromTdee, distributeWeeklyTarget,
  dailyTargetWithActivityCredit, weeklyEnergyDelta, clampGoalToSafety,
} from "./goal";
export {
  type MacroTargets,
  KCAL_PER_G_PROTEIN, KCAL_PER_G_CARB, KCAL_PER_G_FAT,
  computeMacroTargets, macrosToKcal,
} from "./macros";
export {
  type TrendAnalysis, type Trajectory, type TrajectoryVerdict,
  analyzeTrend, classifyTrajectory, expectedRateFromBalance, fullTrajectory,
} from "./trendAnalysis";
export {
  GRAMS_WATER_PER_GRAM_GLYCOGEN,
  carbWaterMassKg, medianCarbBaseline,
} from "./waterAdjust";
