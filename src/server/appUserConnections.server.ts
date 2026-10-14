// Server-only. Persist per-user connector keys, encrypted.
import { encryptConnectionKey, decryptConnectionKey } from "./connectionKeyCrypto.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
  metadata: Record<string, unknown> = {},
) {
  const sb = await admin();
  const { error } = await sb.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      metadata: metadata as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionKeyForUser(userId: string, connectorId: string): Promise<string | null> {
  const sb = await admin();
  const { data, error } = await sb
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  const sb = await admin();
  const { error } = await sb
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
  if (error) throw error;
}

export async function listConnectorsForUser(userId: string): Promise<string[]> {
  const sb = await admin();
  const { data, error } = await sb
    .from("app_user_connections")
    .select("connector_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.connector_id);
}
