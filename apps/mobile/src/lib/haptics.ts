import * as Haptics from "expo-haptics";

/**
 * Thin wrappers so the rest of the app calls a Dense-Matrix-named verb
 * instead of remembering expo-haptics' enum vocabulary. All calls are
 * fire-and-forget; we don't await the Promise — haptics shouldn't gate
 * UI updates.
 */
export const haptic = {
  light:   () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  medium:  () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  heavy:   () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); },
  success: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  warn:    () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
  error:   () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
};
