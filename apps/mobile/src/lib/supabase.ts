import AsyncStorage from "@react-native-async-storage/async-storage";
import { createDataClient, repositories, type Repositories } from "@dynamic-energy/data";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase env not configured. Set EXPO_PUBLIC_SUPABASE_URL and " +
      "EXPO_PUBLIC_SUPABASE_ANON_KEY in your shell or .env before starting Expo.",
  );
}

/**
 * Single shared Supabase client for the whole mobile app. We construct
 * it at module-init time so React Fast Refresh doesn't churn out new
 * clients (which would reset auth state on every save).
 */
export const supabase = createDataClient({
  url,
  anonKey,
  storage: AsyncStorage,
  autoRefreshToken: true,
  // We don't catch the magic-link redirect in-app via URL — we use the
  // OTP code flow instead, which is friction-free without deep linking.
  detectSessionInUrl: false,
});

/** Repositories pre-bound to this client. Import this, not createRepositories. */
export const repos: Repositories = repositories(supabase);
