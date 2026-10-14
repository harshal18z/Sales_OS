import { createServerFn } from "@/server/server-fn.runtime";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { GATEWAY_BASE_URL, GMAIL_CONNECTOR_ID } from "./oauth";

// ---------- helpers ----------

async function getKey(userId: string): Promise<string> {
  const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
  const key = await getConnectionKeyForUser(userId, GMAIL_CONNECTOR_ID);
  if (!key) throw new Error("Gmail is not connected");
  return key;
}

async function gmailFetch(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: GMAIL_CONNECTOR_ID,
    path: `/gmail/v1${path.startsWith("/") ? path : `/${path}`}`,
    init,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

function b64urlEncode(str: string): string {
  // Buffer is available on server runtime
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildRawEmail(opts: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : "",
    opts.bcc ? `Bcc: ${opts.bcc}` : "",
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : "",
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : "",
    opts.references ? `References: ${opts.references}` : "",
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    "",
    opts.body,
  ].filter(Boolean);
  return b64urlEncode(lines.join("\r\n"));
}

async function logGmailActivity(
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
      entity_type: "gmail",
      entity_id: null,
      action,
      metadata: metadata as never,
    });
  }
}

function emailAddresses(...values: Array<string | undefined>): string[] {
  return [...new Set(values.flatMap((value) =>
    (value ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [],
  ).map((address) => address.toLowerCase()))];
}

async function assertNotSuppressed(context: { supabase: any; userId: string }, ...recipients: Array<string | undefined>) {
  const addresses = emailAddresses(...recipients);
  if (!addresses.length) throw new Error("Add at least one valid recipient email address.");
  const { data: member, error: memberError } = await context.supabase
    .from("workspace_members").select("workspace_id").eq("user_id", context.userId).limit(1).maybeSingle();
  if (memberError) throw memberError;
  if (!member?.workspace_id) throw new Error("Your account is not connected to a workspace.");
  const { data, error } = await context.supabase.from("email_suppressions")
    .select("email").eq("workspace_id", member.workspace_id).in("email", addresses);
  if (error) throw new Error("Could not verify the workspace suppression list; sending was stopped.");
  const blocked = (data ?? []).map((row: { email: string }) => row.email);
  if (blocked.length) throw new Error(`Sending stopped: ${blocked.join(", ")} is on this workspace's suppression list.`);
}

// ---------- header helpers ----------

type GmailHeader = { name: string; value: string };
function header(hs: GmailHeader[] | undefined, name: string): string {
  return hs?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// ---------- server functions ----------

export const gmailListMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { folder?: string; query?: string; max?: number }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const params = new URLSearchParams();
    params.set("maxResults", String(data.max ?? 20));
    const folderLabel: Record<string, string> = {
      inbox: "INBOX",
      sent: "SENT",
      drafts: "DRAFT",
      starred: "STARRED",
    };
    const labelId = folderLabel[data.folder ?? "inbox"];
    if (labelId) params.append("labelIds", labelId);
    if (data.query) params.set("q", data.query);
    const list = (await gmailFetch(key, `/users/me/messages?${params}`)) as {
      messages?: Array<{ id: string; threadId: string }>;
    };
    const ids = (list.messages ?? []).slice(0, data.max ?? 20);
    // Fetch metadata for each in parallel (limited)
    const details = await Promise.all(
      ids.map(async (m) => {
        const msg = (await gmailFetch(
          key,
          `/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
        )) as {
          id: string;
          threadId: string;
          snippet: string;
          labelIds?: string[];
          payload?: { headers?: GmailHeader[] };
          internalDate?: string;
        };
        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: msg.snippet,
          labelIds: msg.labelIds ?? [],
          from: header(msg.payload?.headers, "From"),
          to: header(msg.payload?.headers, "To"),
          subject: header(msg.payload?.headers, "Subject"),
          date: header(msg.payload?.headers, "Date"),
          messageId: header(msg.payload?.headers, "Message-ID"),
          internalDate: msg.internalDate,
          unread: (msg.labelIds ?? []).includes("UNREAD"),
        };
      }),
    );
    return { messages: details };
  });

export const gmailGetMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const msg = (await gmailFetch(key, `/users/me/messages/${data.id}?format=full`)) as {
      id: string;
      threadId: string;
      snippet: string;
      labelIds?: string[];
      payload?: {
        headers?: GmailHeader[];
        mimeType?: string;
        body?: { data?: string };
        parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
      };
    };
    // Extract text body
    let body = "";
    const decode = (b64?: string) =>
      b64 ? Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "";
    if (msg.payload?.body?.data) body = decode(msg.payload.body.data);
    else if (msg.payload?.parts) {
      const text = msg.payload.parts.find((p) => p.mimeType === "text/plain");
      const html = msg.payload.parts.find((p) => p.mimeType === "text/html");
      body = decode(text?.body?.data) || decode(html?.body?.data);
    }
    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet,
      labelIds: msg.labelIds ?? [],
      from: header(msg.payload?.headers, "From"),
      to: header(msg.payload?.headers, "To"),
      cc: header(msg.payload?.headers, "Cc"),
      subject: header(msg.payload?.headers, "Subject"),
      date: header(msg.payload?.headers, "Date"),
      messageId: header(msg.payload?.headers, "Message-ID"),
      references: header(msg.payload?.headers, "References"),
      body,
    };
  });

export const gmailListLabels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getKey(context.userId);
    const res = (await gmailFetch(key, "/users/me/labels")) as {
      labels?: Array<{ id: string; name: string; type: string }>;
    };
    return { labels: res.labels ?? [] };
  });

export const gmailListThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string; max?: number }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const params = new URLSearchParams();
    params.set("maxResults", String(data.max ?? 20));
    if (data.query) params.set("q", data.query);
    const res = (await gmailFetch(key, `/users/me/threads?${params}`)) as {
      threads?: Array<{ id: string; snippet: string; historyId: string }>;
    };
    return { threads: res.threads ?? [] };
  });

export const gmailSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
      threadId?: string;
      inReplyTo?: string;
      references?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertNotSuppressed(context, data.to, data.cc, data.bcc);
    const key = await getKey(context.userId);
    const raw = buildRawEmail(data);
    const body = data.threadId ? { raw, threadId: data.threadId } : { raw };
    const res = (await gmailFetch(key, "/users/me/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })) as { id: string; threadId: string };
    await logGmailActivity(context, "gmail.sent", { to: data.to, subject: data.subject });
    return res;
  });

export const gmailReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const msg = (await gmailFetch(
      key,
      `/users/me/messages/${data.messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`,
    )) as { threadId: string; payload?: { headers?: GmailHeader[] } };
    const from = header(msg.payload?.headers, "From");
    const subject = header(msg.payload?.headers, "Subject");
    const messageId = header(msg.payload?.headers, "Message-ID");
    const references = header(msg.payload?.headers, "References");
    await assertNotSuppressed(context, from);
    const raw = buildRawEmail({
      to: from,
      subject: subject.startsWith("Re: ") ? subject : `Re: ${subject}`,
      body: data.body,
      inReplyTo: messageId,
      references: [references, messageId].filter(Boolean).join(" ").trim(),
    });
    const res = (await gmailFetch(key, "/users/me/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, threadId: msg.threadId }),
    })) as { id: string; threadId: string };
    await logGmailActivity(context, "gmail.replied", { to: from, subject });
    return res;
  });

export const gmailForward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; to: string; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const full = (await gmailFetch(key, `/users/me/messages/${data.messageId}?format=full`)) as {
      payload?: {
        headers?: GmailHeader[];
        parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
        body?: { data?: string };
      };
    };
    const subject = header(full.payload?.headers, "Subject");
    await assertNotSuppressed(context, data.to);
    const decode = (b64?: string) =>
      b64 ? Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "";
    let quoted = decode(full.payload?.body?.data);
    if (!quoted && full.payload?.parts) {
      const text = full.payload.parts.find((p) => p.mimeType === "text/plain");
      quoted = decode(text?.body?.data);
    }
    const body =
      (data.note ? `${data.note}\n\n` : "") +
      `---------- Forwarded message ----------\n${quoted ?? ""}`;
    const raw = buildRawEmail({
      to: data.to,
      subject: subject.startsWith("Fwd: ") ? subject : `Fwd: ${subject}`,
      body,
    });
    const res = (await gmailFetch(key, "/users/me/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    })) as { id: string; threadId: string };
    await logGmailActivity(context, "gmail.forwarded", { to: data.to, subject });
    return res;
  });

export const gmailCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { to: string; subject: string; body: string; cc?: string; bcc?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const raw = buildRawEmail(data);
    const res = (await gmailFetch(key, "/users/me/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { raw } }),
    })) as { id: string; message: { id: string; threadId: string } };
    await logGmailActivity(context, "gmail.draft_created", { to: data.to, subject: data.subject });
    return res;
  });

export const gmailMarkRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; read: boolean }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    await gmailFetch(key, `/users/me/messages/${data.id}/modify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        data.read ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] },
      ),
    });
    return { ok: true };
  });

export const gmailTrash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    await gmailFetch(key, `/users/me/messages/${data.id}/trash`, { method: "POST" });
    await logGmailActivity(context, "gmail.trashed", { id: data.id });
    return { ok: true };
  });

// Scheduled sends are stored as drafts with a scheduled_at metadata. A background
// worker (or the /api/public/cron endpoint) sweeps and sends them at the target time.
export const gmailScheduleSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      to: string;
      subject: string;
      body: string;
      scheduledAt: string; // ISO
      cc?: string;
      bcc?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!Number.isFinite(Date.parse(data.scheduledAt)) || Date.parse(data.scheduledAt) <= Date.now()) {
      throw new Error("Choose a future scheduled send time.");
    }
    await assertNotSuppressed(context, data.to, data.cc, data.bcc);
    const key = await getKey(context.userId);
    const raw = buildRawEmail(data);
    const draft = (await gmailFetch(key, "/users/me/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { raw } }),
    })) as { id: string };
    // Persist a durable queue row. A private cron endpoint sends due Gmail drafts.
    const { data: member } = await context.supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    if (!member?.workspace_id) {
      await gmailFetch(key, `/users/me/drafts/${draft.id}`, { method: "DELETE" }).catch(() => undefined);
      throw new Error("Your account is not connected to a workspace.");
    }
    const { error: queueError } = await (context.supabase as any).from("scheduled_email_jobs").insert({
      workspace_id: member.workspace_id,
      user_id: context.userId,
      gmail_draft_id: draft.id,
      recipients: emailAddresses(data.to, data.cc, data.bcc),
      scheduled_at: data.scheduledAt,
    });
    if (queueError) {
      await gmailFetch(key, `/users/me/drafts/${draft.id}`, { method: "DELETE" }).catch(() => undefined);
      throw queueError;
    }
    await logGmailActivity(context, "gmail.scheduled", {
      to: data.to,
      subject: data.subject,
      scheduled_at: data.scheduledAt,
    });
    return { draftId: draft.id, scheduledAt: data.scheduledAt };
  });

export const gmailTrackReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string; since?: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await getKey(context.userId);
    const thread = (await gmailFetch(key, `/users/me/threads/${data.threadId}?format=metadata`)) as {
      messages?: Array<{
        id: string;
        internalDate?: string;
        labelIds?: string[];
        payload?: { headers?: GmailHeader[] };
      }>;
    };
    const sinceMs = data.since ? new Date(data.since).getTime() : 0;
    const replies = (thread.messages ?? [])
      .filter((m) => Number(m.internalDate ?? 0) >= sinceMs)
      .filter((m) => !(m.labelIds ?? []).includes("SENT"))
      .map((m) => ({
        id: m.id,
        from: header(m.payload?.headers, "From"),
        subject: header(m.payload?.headers, "Subject"),
        date: header(m.payload?.headers, "Date"),
      }));
    return { replies };
  });
