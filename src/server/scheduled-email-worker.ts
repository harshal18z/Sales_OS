import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { GATEWAY_BASE_URL, GMAIL_CONNECTOR_ID } from "@/server/functions/oauth";

export async function runScheduledEmailWorker(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Scheduled email worker is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: jobs, error } = await admin.rpc("claim_scheduled_email_jobs", { batch_size: 25 });
  if (error) throw error;
  let sent = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    try {
      const { data: suppressed, error: suppressionError } = await admin
        .from("email_suppressions")
        .select("email")
        .eq("workspace_id", job.workspace_id)
        .in("email", job.recipients);
      if (suppressionError) throw suppressionError;
      if ((suppressed ?? []).length) throw new Error("Recipient is on the workspace suppression list.");

      const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
      const connectionKey = await getConnectionKeyForUser(job.user_id, GMAIL_CONNECTOR_ID);
      if (!connectionKey) throw new Error("The Gmail connection for this scheduled message is no longer available.");

      const response = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: connectionKey,
        connectorId: GMAIL_CONNECTOR_ID,
        path: "/gmail/v1/users/me/drafts/send",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: job.gmail_draft_id }),
        },
      });
      if (!response.ok) throw new Error(`Gmail returned ${response.status}; the message was not confirmed as sent.`);

      const { error: updateError } = await admin.from("scheduled_email_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString(), claimed_at: null, last_error: null })
        .eq("id", job.id);
      if (updateError) throw updateError;
      sent++;
    } catch (jobError) {
      const message = jobError instanceof Error ? jobError.message : "Scheduled message failed.";
      const { error: updateError } = await admin.from("scheduled_email_jobs")
        .update({ status: "failed", claimed_at: null, last_error: message.slice(0, 500) })
        .eq("id", job.id);
      if (updateError) console.error("Could not record scheduled email failure", updateError);
      failed++;
    }
  }

  return Response.json({ claimed: jobs?.length ?? 0, sent, failed });
}
