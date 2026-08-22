import { createClient } from "@supabase/supabase-js";

export function readSupabaseEnv(env = import.meta.env) {
  return {
    url: String(env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, ""),
    anonKey: String(env.VITE_SUPABASE_ANON_KEY ?? ""),
  };
}

export function createSupabaseClient(env = import.meta.env) {
  const { url, anonKey } = readSupabaseEnv(env);

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}
