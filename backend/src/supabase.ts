import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "./env";

export type SupabaseAdminClient = SupabaseClient;

export const getSupabaseAdminClient = (): SupabaseAdminClient | null => {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

