import { supabase } from "@/integrations/supabase/client";

type Payload<T> = { data: T };

/** Calls the authenticated server API. Handler implementations are kept out of browser bundles. */
export function callServerFn<TInput = undefined, TOutput = unknown>(name: string) {
  return async (payload?: Payload<TInput>): Promise<TOutput> => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error("Sign in to continue.");
    const response = await fetch("/api/rpc", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name, payload: payload ?? {} }),
    });
    const result = await response.json().catch(() => ({})) as { data?: TOutput; error?: string };
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result.data as TOutput;
  };
}

export function useServerFn<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}
