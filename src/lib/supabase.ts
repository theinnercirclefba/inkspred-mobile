import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

/**
 * Reads a public Supabase config value. Prefers the standard EXPO_PUBLIC_*
 * process env (inlined at build time); falls back to app.json `extra` so the
 * app also works in bare `expo export` / EAS builds where the env isn't set.
 */
function readConfig(key: "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_ANON_KEY"): string {
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[key];
  if (fromExtra) return fromExtra;
  throw new Error(`Missing Supabase config: ${key}`);
}

const supabaseUrl = readConfig("EXPO_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = readConfig("EXPO_PUBLIC_SUPABASE_ANON_KEY");

/**
 * Shared Supabase client for the native app. The anon key is public-safe by
 * design (row-level security enforces access). Sessions persist in
 * AsyncStorage and refresh automatically while the app is foregrounded.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
