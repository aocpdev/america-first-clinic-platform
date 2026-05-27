import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

type SupabaseClientInstance = ReturnType<typeof createClient>;

type SupabaseAdminClient = SupabaseClientInstance & {
  auth: SupabaseClientInstance["auth"] & {
    admin: {
      createUser: (...args: any[]) => any;
      updateUserById: (...args: any[]) => any;
      deleteUser: (...args: any[]) => any;
    };
  };
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function supabaseCookieOptions(): CookieOptions {
  const isProductionUrl = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";

  return {
    path: "/",
    sameSite: isProductionUrl ? "none" : "lax",
    secure: isProductionUrl
  };
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookieOptions: supabaseCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Server Components cannot mutate cookies. Auth actions and routes
              // can still persist refreshed Supabase cookies through this client.
            }
          });
        }
      }
    }
  );
}

export function createSupabaseAdminClient(): SupabaseAdminClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  ) as SupabaseAdminClient;
}
