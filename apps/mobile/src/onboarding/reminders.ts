import AsyncStorage from "@react-native-async-storage/async-storage";
import { type RemindersState } from "./assessment";

const KEY = "reminders.prefs.v1";

export const saveReminderPrefs = async (prefs: RemindersState): Promise<void> => {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
};

export const loadReminderPrefs = async (): Promise<RemindersState | null> => {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RemindersState;
  } catch {
    return null;
  }
};
