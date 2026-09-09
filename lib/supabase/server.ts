import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { supabaseConfigured } from "./client";

export async function createServerSupabase() {
  if (!supabaseConfigured()) return null;
  const jar = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try {
            list.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* set from Server Component — middleware will persist */
          }
        },
      },
    },
  );
}
