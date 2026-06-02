import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Strongly-typed Supabase client. Mobile and web each construct one with
 * their own storage adapter:
 *
 *   const client = createDataClient({
 *     url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
 *     anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
 *     storage: AsyncStorage,        // mobile
 *   });
 *
 * Storage is optional — web defers to supabase-js's default localStorage
 * adapter. Mobile MUST pass an AsyncStorage shim so sessions persist
 * across launches.
 */
export interface DataClientConfig {
  url: string;
  anonKey: string;
  /** Optional storage adapter (e.g. @react-native-async-storage/async-storage). */
  storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  };
  /**
   * Where the auth listener should run. RN must explicitly opt in to
   * background token refresh; web has it by default.
   */
  autoRefreshToken?: boolean;
  detectSessionInUrl?: boolean;
}

/**
 * The supabase-js client. We intentionally don't pass the `Database`
 * generic here — recent versions of postgrest-js's select query parser
 * complain about hand-written schemas with empty Relationships. The
 * row-typing safety we want lives in `mappers.ts`, which casts each
 * row into the domain type at a single seam. Outside this package,
 * everything is fully typed in the engine's branded vocabulary.
 *
 * When `supabase gen types typescript` is wired in (post-MVP), swap
 * back to `SupabaseClient<Database>` and the repositories below will
 * get full insert/update inference for free.
 */
export type DataClient = SupabaseClient;

export const createDataClient = (cfg: DataClientConfig): DataClient =>
  createClient(cfg.url, cfg.anonKey, {
    auth: {
      ...(cfg.storage ? { storage: cfg.storage } : {}),
      autoRefreshToken: cfg.autoRefreshToken ?? true,
      persistSession: true,
      detectSessionInUrl: cfg.detectSessionInUrl ?? false,
    },
  });
