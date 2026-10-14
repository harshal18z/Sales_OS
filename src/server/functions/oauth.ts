import { createServerFn } from "@/server/server-fn.runtime";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeAppUserOAuth, disconnectAppUser } from "@/integrations/lovable/appUserConnector";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export const GMAIL_CONNECTOR_ID = "google_mail";
export const CALENDAR_CONNECTOR_ID = "google_calendar";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
];

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((targetOrigin: string) => targetOrigin)
  .handler(async ({ data: targetOrigin, context }) => {
    const clientKey = process.env.GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY;
    if (!clientKey) throw new Error("Gmail connector is not configured");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: GMAIL_CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl: targetOrigin,
      responseMode: "web_message",
      webMessageTargetOrigin: targetOrigin,
      credentialsConfiguration: { scopes: GMAIL_SCOPES },
    });
    return { authorizationUrl };
  });

export const startCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((targetOrigin: string) => targetOrigin)
  .handler(async ({ data: targetOrigin, context }) => {
    const clientKey = process.env.GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY;
    if (!clientKey) throw new Error("Calendar connector is not configured");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CALENDAR_CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl: targetOrigin,
      responseMode: "web_message",
      webMessageTargetOrigin: targetOrigin,
      credentialsConfiguration: { scopes: CALENDAR_SCOPES },
    });
    return { authorizationUrl };
  });

export const saveAppUserConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectorId: string; connectionAPIKey: string }) => input)
  .handler(async ({ data, context }) => {
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    await saveConnectionKeyForUser(context.userId, data.connectorId, data.connectionAPIKey);
    // activity log via user-scoped client (RLS: user must be a member of a workspace)
    const { data: member } = await context.supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    if (member?.workspace_id) {
      await context.supabase.from("activity_logs").insert({
        workspace_id: member.workspace_id,
        entity_type: "integration",
        entity_id: null,
        action: `${data.connectorId}.connected`,
        metadata: { connector: data.connectorId } as never,
      });
    }
    return { ok: true };
  });

export const disconnectConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((connectorId: string) => connectorId)
  .handler(async ({ data: connectorId, context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const key = await getConnectionKeyForUser(context.userId, connectorId);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId,
        });
      } catch (e) {
        // Continue — still remove local record even if gateway call fails
        console.error("Gateway disconnect failed:", e);
      }
    }
    await deleteConnectionForUser(context.userId, connectorId);
    const { data: member } = await context.supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    if (member?.workspace_id) {
      await context.supabase.from("activity_logs").insert({
        workspace_id: member.workspace_id,
        entity_type: "integration",
        entity_id: null,
        action: `${connectorId}.disconnected`,
        metadata: { connector: connectorId } as never,
      });
    }
    return { ok: true };
  });

export const getConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listConnectorsForUser } = await import("@/server/appUserConnections.server");
    const connectors = await listConnectorsForUser(context.userId);
    return {
      gmail: connectors.includes(GMAIL_CONNECTOR_ID),
      calendar: connectors.includes(CALENDAR_CONNECTOR_ID),
    };
  });
