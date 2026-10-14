import { createFileRoute, Link } from "@/lib/router-compat";
import { useMemo } from "react";
import { ArrowLeft, CalendarClock, Mail, Pause, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCampaigns, useEmails, useUpdateRow } from "@/hooks/use-data";
import { useAICampaignGenerator, useScheduleCampaign } from "@/hooks/use-ai";
import { EmptyState, PageHeader, PrimaryBtn } from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/campaigns/$id")({
  head: () => ({ meta: [{ title: "Campaign — SalesOS AI" }] }),
  component: CampaignDetail,
});

type SequenceStep = { step?: number; day_offset?: number; channel?: string; type?: string; subject?: string; body?: string; cta?: string; best_send_time?: string; spam_score?: number };

function CampaignDetail() {
  const { id } = Route.useParams();
  const campaigns = useCampaigns();
  const emails = useEmails();
  const update = useUpdateRow("campaigns", "campaigns");
  const generate = useAICampaignGenerator();
  const schedule = useScheduleCampaign();
  const campaign = (campaigns.data ?? []).find((row: any) => row.id === id);
  const sent = useMemo(() => (emails.data ?? []).filter((email: any) => email.campaign_id === id), [emails.data, id]);
  if (campaigns.isLoading) return <div className="p-8 text-sm text-foreground-muted">Loading campaign…</div>;
  if (!campaign) return <div className="p-8"><EmptyState icon={Mail} title="Campaign not found" description="It may have been removed or belong to another workspace." /></div>;

  const sequence = (campaign.ai_sequence ?? null) as { summary?: string; audience?: string; best_send_window?: string; spam_score_avg?: number; personalization_score?: number; steps?: SequenceStep[] } | null;
  const steps = Array.isArray(sequence?.steps) ? sequence.steps : [];
  const status = String(campaign.status || "draft").toLowerCase();
  const isReady = steps.length > 0;
  const makeSequence = async () => {
    try { await generate.mutateAsync({ campaignId: id, channel: campaign.channel === "multi" ? "multi" : "email", touches: Number(campaign.settings?.touches) || 5, force: true }); }
    catch { /* mutation displays the error */ }
  };
  const setStatus = async (next: "active" | "paused") => {
    if (next === "active" && !isReady) return toast.error("Generate and review the sequence before activating the campaign.");
    if (next === "active" && !window.confirm("I reviewed this sequence and approve activating the campaign.")) return;
    try { await schedule.mutateAsync({ campaignId: id, status: next }); toast.success(next === "active" ? "Campaign activated" : "Campaign paused"); }
    catch (error) { toast.error((error as Error).message); }
  };
  const saveCampaign = async () => {
    try { await update.mutateAsync({ id, values: { name: campaign.name, description: campaign.description } }); }
    catch (error) { toast.error((error as Error).message); }
  };
  const countBy = (s: string) => sent.filter((email: any) => String(email.status).toLowerCase() === s).length;
  const responseRate = sent.length ? Math.round((countBy("replied") / sent.length) * 100) : 0;

  return (
    <div className="min-h-full">
      <PageHeader title={campaign.name} subtitle={campaign.description || campaign.goal || "Campaign sequence and performance"} action={
        <div className="flex gap-2">
          <Link to="/campaigns" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] text-foreground-muted"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
          {status === "active" ? <button onClick={() => setStatus("paused")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-[12px]"><Pause className="h-3.5 w-3.5" /> Pause</button> : <PrimaryBtn onClick={() => setStatus("active")} disabled={!isReady || schedule.isPending}><Play className="h-3.5 w-3.5" /> Activate</PrimaryBtn>}
        </div>
      } />
      <main className="p-6 space-y-6 max-w-7xl">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Status" value={status} />
          <Metric label="Emails" value={String(sent.length)} />
          <Metric label="Sent" value={String(countBy("sent"))} />
          <Metric label="Reply rate" value={`${responseRate}%`} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="text-[15px] font-semibold">Outreach sequence</h2><p className="mt-1 text-[12px] text-foreground-muted">Generated copy is saved for review before you activate.</p></div><PrimaryBtn onClick={makeSequence} disabled={generate.isPending}><Sparkles className="h-3.5 w-3.5" />{generate.isPending ? "Generating…" : isReady ? "Regenerate" : "Generate sequence"}</PrimaryBtn></div>
            {sequence?.summary && <div className="border-b border-border bg-surface-muted/30 px-5 py-4"><p className="text-[13px] text-foreground-muted">{sequence.summary}</p>{sequence.audience && <p className="mt-1 text-[11px] text-foreground-subtle">Audience: {sequence.audience}</p>}</div>}
            {steps.length === 0 ? <div className="p-6"><EmptyState icon={Sparkles} title="No sequence yet" description="Generate a sequence to create campaign steps you can review." /></div> : <ol className="divide-y divide-border">{steps.map((step, index) => <li key={`${step.step ?? index}-${index}`} className="grid gap-3 p-5 sm:grid-cols-[44px_minmax(0,1fr)]"><div className="grid h-9 w-9 place-items-center rounded-full border border-border text-[12px] font-semibold">{step.step ?? index + 1}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold">Day {step.day_offset ?? 0} · {step.type || step.channel || "Touch"}</h3>{step.channel && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] capitalize text-foreground-muted">{step.channel}</span>}{step.spam_score != null && <span className="text-[10px] text-foreground-subtle">Spam risk {step.spam_score}/100</span>}</div>{step.subject && <p className="mt-2 text-[12px] font-medium">{step.subject}</p>}<p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-5 text-foreground-muted">{step.body || "No message body"}</p>{step.cta && <p className="mt-2 text-[11px] text-foreground-subtle">CTA: {step.cta}</p>}</div></li>)}</ol>}
          </section>
          <aside className="space-y-4">
            <section className="rounded-xl border border-border bg-surface p-5"><h2 className="text-[14px] font-semibold">Campaign setup</h2><div className="mt-4 space-y-3"><Info label="Goal" value={campaign.goal || "—"} /><Info label="Channel" value={campaign.channel || "Email"} /><Info label="Scheduled" value={campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : "Not scheduled"} /><Info label="Best send window" value={sequence?.best_send_window || "—"} /><Info label="Personalization" value={sequence?.personalization_score == null ? "—" : `${sequence.personalization_score}/100`} /></div><button onClick={saveCampaign} disabled={update.isPending} className="mt-4 text-[11px] text-foreground-subtle hover:text-foreground">Save campaign details</button></section>
            <section className="rounded-xl border border-border bg-surface p-5"><h2 className="text-[14px] font-semibold">Delivery log</h2>{sent.length === 0 ? <p className="mt-3 text-[12px] text-foreground-subtle">No emails linked to this campaign yet.</p> : <div className="mt-3 space-y-2">{sent.slice(0, 8).map((email: any) => <div key={email.id} className="rounded-lg border border-border p-3"><p className="truncate text-[12px] font-medium">{email.subject || "(no subject)"}</p><p className="mt-1 text-[10px] text-foreground-subtle">{email.status} · {new Date(email.created_at).toLocaleDateString()}</p></div>)}</div>}<Link to="/emails" className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-foreground-muted"><Mail className="h-3 w-3" /> Open email workspace</Link></section>
            <div className="rounded-xl border border-border bg-surface-muted/30 p-4"><p className="flex items-center gap-2 text-[12px] font-medium"><CalendarClock className="h-3.5 w-3.5" />Human review</p><p className="mt-1 text-[11px] leading-5 text-foreground-muted">Review every step, audience, and send schedule before activation. Campaign activation does not send messages until an email delivery worker is configured.</p></div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-surface p-4"><p className="text-[11px] text-foreground-subtle">{label}</p><p className="mt-2 text-[18px] font-semibold capitalize">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] uppercase tracking-wide text-foreground-subtle">{label}</p><p className="mt-1 text-[12px] text-foreground-muted">{value}</p></div>; }
