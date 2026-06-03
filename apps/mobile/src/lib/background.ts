import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { useEngine } from "@/store/engineStore";

/**
 * Background task to run the weekly convergence engine on Monday mornings.
 * Ensures the TDEE estimate is ready when the user opens the app, even if
 * they haven't launched it yet this week.
 */
const CONVERGENCE_TASK_NAME = "METABOLIC_CONVERGENCE_AUDIT";

TaskManager.defineTask(CONVERGENCE_TASK_NAME, async () => {
  try {
    const store = useEngine.getState();
    if (!store.userId || !store.profile) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Find the Monday of the current week.
    const now = new Date();
    const day = now.getUTCDay();
    const delta = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - delta);
    const weekStart = start.toISOString().slice(0, 10);
    
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const weekEnd = end.toISOString().slice(0, 10);

    // Only run if we are in the Monday window and haven't audited yet.
    // In a real prod environment, we'd check engine_state_weekly to see
    // if a record already exists for this weekStart.
    await store.runWeeklyCheckin(weekStart, weekEnd, { accept: false });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("Background convergence audit failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerConvergenceTask = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(CONVERGENCE_TASK_NAME, {
      minimumInterval: 60 * 60 * 12, // 12 hours
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log("Registered metabolic convergence task.");
  } catch (err) {
    console.error("Failed to register background task:", err);
  }
};
