import { createServerFn } from "@/server/server-fn.runtime";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { GATEWAY_BASE_URL, CALENDAR_CONNECTOR_ID } from "./oauth";

async function getKey(userId: string): Promise<string> {
  const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
  const key = await getConnectionKeyForUser(userId, CALENDAR_CONNECTOR_ID);
  if (!key) throw new Error("Google Calendar is not connected");
  return key;
}

async function calFetch(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CALENDAR_CONNECTOR_ID,
    path: `/calendar/v3${path.startsWith("/") ? path : `/${path}`}`,
    init,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Calendar ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

async function logCalActivity(
  context: { supabase: any; userId: string },
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const { data: member } = await context.supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", context.userId)
    .limit(1)
    .maybeSingle();
  if (member?.workspace_id) {
    await context.supabase.from("activity_logs").insert({
      workspace_id: member.workspace_id,
      entity_type: "calendar",
      entity_id: null,
      action,
      metadata: metadata as never,
    });
  }
}

export const calendarListEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { timeMin?: string; timeMax?: string; max?: number; calendarId?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const params = new URLSearchParams();
    params.set("maxResults", String(data.max ?? 50));
    params.set("singleEvents", "true");
    params.set("orderBy", "startTime");
    params.set("timeMin", data.timeMin ?? new Date().toISOString());
    if (data.timeMax) params.set("timeMax", data.timeMax);
    const calId = data.calendarId ?? "primary";
    const res = (await calFetch(key, `/calendars/${encodeURIComponent(calId)}/events?${params}`)) as {
      items?: Array<{
        id: string;
        summary?: string;
        description?: string;
        location?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        attendees?: Array<{ email: string; responseStatus?: string; displayName?: string }>;
        hangoutLink?: string;
        htmlLink?: string;
        status?: string;
        reminders?: { overrides?: Array<{ method: string; minutes: number }>; useDefault?: boolean };
      }>;
    };
    return { events: res.items ?? [] };
  });

export const calendarCreateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      summary: string;
      description?: string;
      location?: string;
      startISO: string;
      endISO: string;
      attendees?: string[];
      reminderMinutes?: number;
      calendarId?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const body: Record<string, unknown> = {
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: { dateTime: data.startISO },
      end: { dateTime: data.endISO },
      attendees: (data.attendees ?? []).map((email: string) => ({ email })),
    };
    if (typeof data.reminderMinutes === "number") {
      body.reminders = {
        useDefault: false,
        overrides: [{ method: "popup", minutes: data.reminderMinutes }],
      };
    }
    const calId = data.calendarId ?? "primary";
    const event = (await calFetch(key, `/calendars/${encodeURIComponent(calId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })) as { id: string; htmlLink: string };
    await logCalActivity(context, "calendar.event_created", {
      summary: data.summary,
      event_id: event.id,
    });
    return event;
  });

export const calendarUpdateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      eventId: string;
      summary?: string;
      description?: string;
      location?: string;
      startISO?: string;
      endISO?: string;
      attendees?: string[];
      calendarId?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const body: Record<string, unknown> = {};
    if (data.summary !== undefined) body.summary = data.summary;
    if (data.description !== undefined) body.description = data.description;
    if (data.location !== undefined) body.location = data.location;
    if (data.startISO) body.start = { dateTime: data.startISO };
    if (data.endISO) body.end = { dateTime: data.endISO };
    if (data.attendees) body.attendees = data.attendees.map((email: string) => ({ email }));
    const calId = data.calendarId ?? "primary";
    const event = (await calFetch(
      key,
      `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(data.eventId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    )) as { id: string };
    await logCalActivity(context, "calendar.event_updated", { event_id: data.eventId });
    return event;
  });

export const calendarCancelEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; calendarId?: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const calId = data.calendarId ?? "primary";
    await calFetch(
      key,
      `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(data.eventId)}`,
      { method: "DELETE" },
    );
    await logCalActivity(context, "calendar.event_cancelled", { event_id: data.eventId });
    return { ok: true };
  });

export const calendarAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { timeMin: string; timeMax: string; calendarIds?: string[] }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const calendars = (data.calendarIds ?? ["primary"]).map((id: string) => ({ id }));
    const res = (await calFetch(key, "/freeBusy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: data.timeMin, timeMax: data.timeMax, items: calendars }),
    })) as { calendars?: Record<string, { busy: Array<{ start: string; end: string }> }> };
    return res;
  });

export const calendarListCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getKey(context.userId);
    const res = (await calFetch(key, "/users/me/calendarList")) as {
      items?: Array<{ id: string; summary: string; primary?: boolean }>;
    };
    return { calendars: res.items ?? [] };
  });
