import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ServerRequestContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  user: User;
};

const requestContext = new AsyncLocalStorage<ServerRequestContext>();

export async function createServerRequestContext(
  accessToken: string,
): Promise<ServerRequestContext> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is incomplete.");
  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user)
    throw new Error("Your session is invalid or has expired. Please sign in again.");
  return { supabase, userId: data.user.id, user: data.user };
}

export function runWithServerRequestContext<T>(
  context: ServerRequestContext,
  callback: () => T,
): T {
  return requestContext.run(context, callback);
}

export function createServerFn(_options?: { method?: string }) {
  let validator: ((input: any) => any) | { parse: (input: any) => any } | undefined;
  const builder: {
    middleware: (_middleware: unknown[]) => typeof builder;
    inputValidator: (inputValidator: any) => typeof builder;
    handler: (
      handler: (args: { data: any; context: ServerRequestContext }) => Promise<unknown>,
    ) => (payload?: { data?: unknown }) => Promise<unknown>;
  } = {
    middleware: () => builder,
    inputValidator: (inputValidator) => {
      validator = inputValidator;
      return builder;
    },
    handler: (handler) => async (payload) => {
      const context = requestContext.getStore();
      if (!context) throw new Error("This operation must run through the authenticated API.");
      let data = payload?.data;
      if (typeof validator === "function") data = validator(data);
      else if (validator && "parse" in validator) data = validator.parse(data);
      return handler({ data, context });
    },
  };
  return builder;
}
