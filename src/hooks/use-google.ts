import { useMutation, useQuery, useQueryClient } from "@/lib/query";
import { useServerFn } from "@/lib/server-fn";
import {
  getConnectionStatus,
  startGmailConnect,
  startCalendarConnect,
  saveAppUserConnection,
  disconnectConnector,
  GMAIL_CONNECTOR_ID,
  CALENDAR_CONNECTOR_ID,
  GATEWAY_BASE_URL,
} from "@/lib/google/oauth.functions";
import {
  gmailListMessages,
  gmailGetMessage,
  gmailListLabels,
  gmailSend,
  gmailReply,
  gmailForward,
  gmailCreateDraft,
  gmailMarkRead,
  gmailTrash,
  gmailScheduleSend,
  gmailTrackReplies,
} from "@/lib/google/gmail.functions";
import {
  calendarListEvents,
  calendarCreateEvent,
  calendarUpdateEvent,
  calendarCancelEvent,
  calendarAvailability,
} from "@/lib/google/calendar.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";

// ---------- Status ----------

export function useGoogleStatus() {
  const fn = useServerFn(getConnectionStatus);
  return useQuery({
    queryKey: ["google-status"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

export function useConnectGmail() {
  const qc = useQueryClient();
  const start = useServerFn(startGmailConnect);
  const save = useServerFn(saveAppUserConnection);
  return useMutation({
    mutationFn: async () => {
      const result = await connectAppUser({
        connectorId: GMAIL_CONNECTOR_ID,
        gatewayBaseUrl: GATEWAY_BASE_URL,
        start: (origin) => start({ data: origin }),
      });
      if (!result.success) throw new Error(result.error ?? "Connection failed");
      if (result.connectionAPIKey) {
        await save({
          data: { connectorId: GMAIL_CONNECTOR_ID, connectionAPIKey: result.connectionAPIKey },
        });
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-status"] });
      qc.invalidateQueries({ queryKey: ["gmail"] });
    },
  });
}

export function useConnectCalendar() {
  const qc = useQueryClient();
  const start = useServerFn(startCalendarConnect);
  const save = useServerFn(saveAppUserConnection);
  return useMutation({
    mutationFn: async () => {
      const result = await connectAppUser({
        connectorId: CALENDAR_CONNECTOR_ID,
        gatewayBaseUrl: GATEWAY_BASE_URL,
        start: (origin) => start({ data: origin }),
      });
      if (!result.success) throw new Error(result.error ?? "Connection failed");
      if (result.connectionAPIKey) {
        await save({
          data: { connectorId: CALENDAR_CONNECTOR_ID, connectionAPIKey: result.connectionAPIKey },
        });
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-status"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useDisconnect(connectorId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(disconnectConnector);
  return useMutation({
    mutationFn: () => fn({ data: connectorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-status"] });
      qc.invalidateQueries({ queryKey: ["gmail"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

// ---------- Gmail ----------

export function useGmailMessages(input: { folder?: string; query?: string; max?: number }, enabled = true) {
  const fn = useServerFn(gmailListMessages);
  return useQuery({
    queryKey: ["gmail", "messages", input],
    queryFn: () => fn({ data: input }),
    enabled,
    staleTime: 30_000,
  });
}

export function useGmailMessage(id: string | null | undefined, enabled = true) {
  const fn = useServerFn(gmailGetMessage);
  return useQuery({
    queryKey: ["gmail", "message", id],
    queryFn: () => fn({ data: { id: id! } }),
    enabled: !!id && enabled,
  });
}

export function useGmailLabels(enabled = true) {
  const fn = useServerFn(gmailListLabels);
  return useQuery({
    queryKey: ["gmail", "labels"],
    queryFn: () => fn(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useGmailSend() {
  const qc = useQueryClient();
  const fn = useServerFn(gmailSend);
  return useMutation({
    mutationFn: (input: NonNullable<Parameters<typeof gmailSend>[0]>["data"]) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail"] }),
  });
}

export function useGmailReply() {
  const qc = useQueryClient();
  const fn = useServerFn(gmailReply);
  return useMutation({
    mutationFn: (input: { messageId: string; body: string }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail"] }),
  });
}

export function useGmailForward() {
  const qc = useQueryClient();
  const fn = useServerFn(gmailForward);
  return useMutation({
    mutationFn: (input: { messageId: string; to: string; note?: string }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail"] }),
  });
}

export function useGmailCreateDraft() {
  const qc = useQueryClient();
  const fn = useServerFn(gmailCreateDraft);
  return useMutation({
    mutationFn: (input: { to: string; subject: string; body: string; cc?: string; bcc?: string }) =>
      fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail"] }),
  });
}

export function useGmailMarkRead() {
  const qc = useQueryClient();
  const fn = useServerFn(gmailMarkRead);
  return useMutation({
    mutationFn: (input: { id: string; read: boolean }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail"] }),
  });
}

export function useGmailTrash() {
  const qc = useQueryClient();
  const fn = useServerFn(gmailTrash);
  return useMutation({
    mutationFn: (input: { id: string }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gmail"] }),
  });
}

export function useGmailScheduleSend() {
  const qc = useQueryClient();
  const fn = useServerFn(gmailScheduleSend);
  return useMutation({
    mutationFn: (
      input: {
        to: string;
        subject: string;
        body: string;
        scheduledAt: string;
        cc?: string;
        bcc?: string;
      },
    ) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmail"] });
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}

export function useGmailTrackReplies(threadId: string | null, since?: string) {
  const fn = useServerFn(gmailTrackReplies);
  return useQuery({
    queryKey: ["gmail", "replies", threadId, since],
    queryFn: () => fn({ data: { threadId: threadId!, since } }),
    enabled: !!threadId,
  });
}

// ---------- Calendar ----------

export function useCalendarEvents(
  input: { timeMin?: string; timeMax?: string; max?: number } = {},
  enabled = true,
) {
  const fn = useServerFn(calendarListEvents);
  return useQuery({
    queryKey: ["calendar", "events", input],
    queryFn: () => fn({ data: input }),
    enabled,
    staleTime: 30_000,
  });
}

export function useCalendarCreate() {
  const qc = useQueryClient();
  const fn = useServerFn(calendarCreateEvent);
  return useMutation({
    mutationFn: (input: NonNullable<Parameters<typeof calendarCreateEvent>[0]>["data"]) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useCalendarUpdate() {
  const qc = useQueryClient();
  const fn = useServerFn(calendarUpdateEvent);
  return useMutation({
    mutationFn: (input: NonNullable<Parameters<typeof calendarUpdateEvent>[0]>["data"]) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useCalendarCancel() {
  const qc = useQueryClient();
  const fn = useServerFn(calendarCancelEvent);
  return useMutation({
    mutationFn: (input: { eventId: string; calendarId?: string }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useCalendarAvailability(input: { timeMin: string; timeMax: string } | null) {
  const fn = useServerFn(calendarAvailability);
  return useQuery({
    queryKey: ["calendar", "availability", input],
    queryFn: () => fn({ data: input! }),
    enabled: !!input,
  });
}
