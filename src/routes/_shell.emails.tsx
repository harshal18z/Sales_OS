import { createFileRoute } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Mail, Plus, Send, Trash2, X, Inbox, Sparkles, Loader2 } from "lucide-react";
import { useDeleteRow, useEmails, useInsertRow, useLeads, useUpdateRow, useCompanies } from "@/hooks/use-data";
import { useAIEmail, type AIEmailType } from "@/hooks/use-ai";
import {
  useGoogleStatus,
  useGmailMessages,
  useGmailMessage,
  useGmailMarkRead,
  useGmailTrash,
  useGmailSend,
  useGmailReply,
} from "@/hooks/use-google";
import {
  EmptyState, Field, GhostBtn, Modal, PageHeader, PrimaryBtn, Select,
  SkeletonList, TextArea, TextInput,
} from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/emails")({
  head: () => ({ meta: [{ title: "Emails — SalesOS AI" }] }),
  component: EmailsPage,
});

const STATUSES = ["draft", "pending", "approved", "scheduled", "sent", "rejected"] as const;
const GMAIL_FOLDERS: { id: string; label: string; query: string }[] = [
  { id: "gmail:inbox", label: "Gmail Inbox", query: "in:inbox" },
  { id: "gmail:sent", label: "Gmail Sent", query: "in:sent" },
  { id: "gmail:drafts", label: "Gmail Drafts", query: "in:drafts" },
];

function EmailsPage() {
  const { data: emails = [], isLoading } = useEmails();
  const { data: leads = [] } = useLeads();
  const { data: companies = [] } = useCompanies();
  const { data: gstatus } = useGoogleStatus();
  const insert = useInsertRow("emails", "emails");
  const update = useUpdateRow("emails", "emails");
  const del = useDeleteRow("emails", "emails");
  const markRead = useGmailMarkRead();
  const gmailTrash = useGmailTrash();
  const gmailSend = useGmailSend();
  const gmailReply = useGmailReply();

  const [folder, setFolder] = useState<string>("draft");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"draft" | "gmail">("draft");
  const [scheduling, setScheduling] = useState<any | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const isGmail = folder.startsWith("gmail:");
  const gmailQuery = GMAIL_FOLDERS.find((f) => f.id === folder)?.query;
  const gmailList = useGmailMessages(
    { query: gmailQuery, max: 25 },
    isGmail && !!gstatus?.gmail,
  );
  const gmailMsg = useGmailMessage(isGmail ? selectedId : null, isGmail);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (emails as any[]).forEach((e) => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [emails]);

  const filtered = (emails as any[]).filter((e) => e.status === folder);
  const selected = isGmail
    ? null
    : filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;
  const gmailMessages = (gmailList.data as any)?.messages ?? [];


  async function setStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    try {
      await update.mutateAsync({ id, values: { status, ...extra } });
      toast.success(status);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this email?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Deleted");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="AI Email Studio"
        subtitle={`${emails.length} emails`}
        action={
          <div className="flex items-center gap-2">
            <GhostBtn onClick={() => setCopilotOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" /> AI Copilot
            </GhostBtn>
            <PrimaryBtn onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New draft
            </PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-0 min-h-[calc(100vh-8rem)]">
        {/* Folders */}
        <aside className="col-span-12 lg:col-span-2 border-r border-border bg-surface/40 p-3">
          <div className="space-y-0.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setFolder(s); setSelectedId(null); }}
                className={`w-full text-left px-3 py-2 rounded-md text-[12.5px] flex items-center justify-between transition ${
                  folder === s
                    ? "bg-surface border border-border text-foreground"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <span className="capitalize">{s}</span>
                <span className="text-[11px] text-foreground-subtle">{counts[s] ?? 0}</span>
              </button>
            ))}
            {gstatus?.gmail && (
              <>
                <div className="mt-3 mb-1 px-3 text-[10px] uppercase tracking-wider text-foreground-subtle">Gmail</div>
                {GMAIL_FOLDERS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setFolder(g.id); setSelectedId(null); }}
                    className={`w-full text-left px-3 py-2 rounded-md text-[12.5px] flex items-center gap-2 transition ${
                      folder === g.id
                        ? "bg-surface border border-border text-foreground"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    <Inbox className="h-3 w-3" />
                    <span>{g.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>


        {/* List */}
        <div className="col-span-12 lg:col-span-4 border-r border-border">
          <div className="p-4">
            {isGmail ? (
              gmailList.isLoading ? (
                <SkeletonList count={5} />
              ) : gmailMessages.length === 0 ? (
                <EmptyState icon={Mail} title="No Gmail messages" description="Nothing in this folder." />
              ) : (
                <div className="space-y-1.5">
                  {gmailMessages.map((m: any) => {
                    const active = selectedId === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedId(m.id);
                          if (m.unread) markRead.mutate({ id: m.id, read: true });
                        }}
                        className={`w-full text-left rounded-lg border p-3 transition ${
                          active ? "border-border-strong bg-surface"
                                 : "border-border bg-surface hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <p className={`text-[13px] truncate flex-1 ${m.unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                            {m.subject || "(no subject)"}
                          </p>
                          <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                            {m.from?.split("<")[0]?.trim().slice(0, 20) || "—"}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-foreground-subtle truncate mt-0.5">
                          {m.snippet || ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )
            ) : isLoading ? (
              <SkeletonList count={5} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Mail}
                title={`No ${folder} emails`}
                description="Compose a new draft to get started."
              />
            ) : (
              <div className="space-y-1.5">
                {filtered.map((e: any) => (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full text-left rounded-lg border p-3 transition ${
                      selectedId === e.id || (selectedId === null && filtered[0]?.id === e.id)
                        ? "border-border-strong bg-surface"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground truncate flex-1">
                        {e.subject || "(no subject)"}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                        {e.tone ?? "—"}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-foreground-subtle truncate mt-0.5">
                      {(e.body ?? "").slice(0, 80) || "No content"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="col-span-12 lg:col-span-6 bg-surface/40">
          <div className="p-6">
            {isGmail ? (
              !selectedId ? (
                <div className="text-[12px] text-foreground-subtle">Select a message to preview.</div>
              ) : gmailMsg.isLoading || !gmailMsg.data ? (
                <SkeletonList count={4} />
              ) : (
                <GmailPreview
                  msg={gmailMsg.data as any}
                  replyBody={replyBody}
                  onReplyBodyChange={setReplyBody}
                  onReply={async () => {
                    if (!replyBody.trim()) return;
                    try {
                      await gmailReply.mutateAsync({ messageId: selectedId!, body: replyBody });
                      toast.success("Reply sent");
                      setReplyBody("");
                    } catch (e) { toast.error((e as Error).message); }
                  }}
                  onTrash={async () => {
                    if (!confirm("Move to trash?")) return;
                    try {
                      await gmailTrash.mutateAsync({ id: selectedId! });
                      toast.success("Trashed");
                      setSelectedId(null);
                    } catch (e) { toast.error((e as Error).message); }
                  }}
                  replying={gmailReply.isPending}
                />
              )
            ) : !selected ? (
              <div className="text-[12px] text-foreground-subtle">Select an email to preview.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">Subject</p>
                  <h2 className="text-[16px] font-semibold text-foreground mt-1">
                    {selected.subject || "(no subject)"}
                  </h2>
                </div>

                <div className="rounded-xl border border-border bg-surface p-5">
                  <p className="text-[13.5px] text-foreground leading-relaxed whitespace-pre-wrap">
                    {selected.body || "No content"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Meta label="Tone" value={selected.tone ?? "—"} />
                  <Meta label="Personalization" value={String(selected.personalization_score ?? 0)} />
                  <Meta label="Spam risk" value={String(selected.spam_risk ?? 0)} />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {selected.status !== "approved" && selected.status !== "sent" && (
                    <PrimaryBtn onClick={() => setStatus(selected.id, "approved")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </PrimaryBtn>
                  )}
                  {selected.status !== "rejected" && selected.status !== "sent" && (
                    <GhostBtn onClick={() => setStatus(selected.id, "rejected")}>
                      <X className="h-3.5 w-3.5" /> Reject
                    </GhostBtn>
                  )}
                  {selected.status !== "sent" && (
                    <GhostBtn onClick={() => setScheduling(selected)}>
                      <Clock className="h-3.5 w-3.5" /> Schedule
                    </GhostBtn>
                  )}
                  {selected.status === "approved" && gstatus?.gmail && (
                    <GhostBtn onClick={async () => {
                      try {
                        // parse "To: <email>" from body or use a fallback: skip if no recipient
                        toast.info("Use Compose → Gmail to send new messages.");
                      } catch (e) { toast.error((e as Error).message); }
                    }}>
                      <Send className="h-3.5 w-3.5" /> Send via Gmail
                    </GhostBtn>
                  )}
                  {selected.status === "approved" && (
                    <GhostBtn onClick={() => setStatus(selected.id, "sent", { sent_at: new Date().toISOString() })}>
                      <Send className="h-3.5 w-3.5" /> Mark sent
                    </GhostBtn>
                  )}
                  <GhostBtn onClick={() => handleDelete(selected.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </GhostBtn>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <EmailForm
        open={creating}
        leads={leads as any[]}
        onClose={() => setCreating(false)}
        onSubmit={async (v) => {
          try {
            await insert.mutateAsync(v);
            toast.success("Draft created");
            setCreating(false);
          } catch (e) { toast.error((e as Error).message); }
        }}
      />

      <AICopilotModal
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        leads={leads as any[]}
        companies={companies as any[]}
        onSaved={() => {
          setCopilotOpen(false);
          setFolder("draft");
        }}
      />

      <Modal
        open={!!scheduling}
        onClose={() => setScheduling(null)}
        title="Schedule email"
      >
        {scheduling && (
          <ScheduleForm
            onClose={() => setScheduling(null)}
            onSubmit={async (iso) => {
              await setStatus(scheduling.id, "scheduled", { scheduled_at: iso });
              setScheduling(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-foreground-subtle">{label}</p>
      <p className="text-[14px] text-foreground mt-1 font-medium">{value}</p>
    </div>
  );
}

function GmailPreview({
  msg, replyBody, onReplyBodyChange, onReply, onTrash, replying,
}: {
  msg: { subject?: string; from?: string; to?: string; date?: string; body?: string; snippet?: string };
  replyBody: string;
  onReplyBodyChange: (v: string) => void;
  onReply: () => void;
  onTrash: () => void;
  replying: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">Subject</p>
        <h2 className="text-[16px] font-semibold text-foreground mt-1">{msg.subject || "(no subject)"}</h2>
        <p className="text-[11.5px] text-foreground-subtle mt-1">
          From {msg.from || "—"} · {msg.date ? new Date(msg.date).toLocaleString() : ""}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-[13.5px] text-foreground leading-relaxed whitespace-pre-wrap">
          {msg.body || msg.snippet || "No content"}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">Reply</p>
        <TextArea rows={4} value={replyBody} onChange={(e) => onReplyBodyChange(e.target.value)} placeholder="Write a reply…" />
        <div className="flex justify-end gap-2">
          <GhostBtn onClick={onTrash}><Trash2 className="h-3.5 w-3.5" /> Trash</GhostBtn>
          <PrimaryBtn onClick={onReply} disabled={replying || !replyBody.trim()}>
            <Send className="h-3.5 w-3.5" /> {replying ? "Sending…" : "Send reply"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}


function EmailForm({
  open,
  onClose,
  onSubmit,
  leads,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: any) => Promise<void>;
  leads: any[];
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("direct");
  const [lead_id, setLead] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="New draft">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          await onSubmit({
            subject,
            body,
            tone,
            status: "draft",
            lead_id: lead_id || null,
            personalization_score: 0,
            spam_risk: 0,
          });
          setSubmitting(false);
          setSubject(""); setBody(""); setTone("direct"); setLead("");
        }}
        className="space-y-3"
      >
        <Field label="Subject"><TextInput required value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tone">
            <Select value={tone} onChange={(e) => setTone(e.target.value)}>
              {["direct", "warm", "executive", "peer", "formal", "conversational"].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Lead">
            <Select value={lead_id} onChange={(e) => setLead(e.target.value)}>
              <option value="">—</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.stage} · {l.id.slice(0, 8)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Body"><TextArea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn type="submit" disabled={submitting || !subject}>Create</PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (iso: string) => Promise<void> }) {
  const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
  const [when, setWhen] = useState(soon);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(new Date(when).toISOString());
      }}
      className="space-y-3"
    >
      <Field label="Send at">
        <TextInput type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn type="submit">Schedule</PrimaryBtn>
      </div>
    </form>
  );
}

// ============ AI Email Copilot ============

const COPILOT_TYPES: { id: AIEmailType; label: string; hint: string }[] = [
  { id: "cold", label: "Cold outreach", hint: "First-touch opener" },
  { id: "follow_up", label: "Follow-up", hint: "Nudge on a live thread" },
  { id: "pricing", label: "Pricing", hint: "Value + pricing framing" },
  { id: "proposal", label: "Proposal", hint: "Delivering a proposal" },
  { id: "meeting_recap", label: "Meeting recap", hint: "Post-call summary + next steps" },
  { id: "re_engagement", label: "Re-engagement", hint: "Revive a dormant deal" },
];

const COPILOT_TONES = ["direct", "warm", "executive", "peer", "formal", "conversational"] as const;
const COPILOT_LENGTHS: { id: "short" | "medium" | "long"; label: string; hint: string }[] = [
  { id: "short", label: "Short", hint: "~60 words" },
  { id: "medium", label: "Medium", hint: "~120 words" },
  { id: "long", label: "Long", hint: "~220 words" },
];

type CopilotDraft = {
  subject: string;
  body: string;
  cta: string;
  cta_suggestions?: string[];
  subject_variants?: string[];
  tone: string;
  personalization_score: number;
  spam_risk: number;
};

function AICopilotModal({
  open, onClose, leads, companies, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  leads: any[];
  companies: any[];
  onSaved: () => void;
}) {
  const [emailType, setEmailType] = useState<AIEmailType>("cold");
  const [tone, setTone] = useState<string>("direct");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [leadId, setLeadId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [ctx, setCtx] = useState<string>("");
  const [draft, setDraft] = useState<CopilotDraft | null>(null);
  const ai = useAIEmail();
  const insert = useInsertRow("emails", "emails");

  async function handleGenerate() {
    setDraft(null);
    try {
      const res = (await ai.mutateAsync({
        emailType,
        tone,
        length,
        leadId: leadId || undefined,
        companyId: companyId || undefined,
        context: ctx || undefined,
        save: false,
      })) as { output: CopilotDraft };
      if (res?.output) {
        setDraft({
          subject: res.output.subject ?? "",
          body: res.output.body ?? "",
          cta: res.output.cta ?? "",
          cta_suggestions: res.output.cta_suggestions ?? [],
          subject_variants: res.output.subject_variants ?? [],
          tone: res.output.tone ?? tone,
          personalization_score: res.output.personalization_score ?? 0,
          spam_risk: res.output.spam_risk ?? 0,
        });
      }
    } catch { /* toast handled */ }
  }

  async function handleSave() {
    if (!draft) return;
    try {
      await insert.mutateAsync({
        subject: draft.subject,
        body: draft.body,
        tone: draft.tone,
        status: "draft",
        lead_id: leadId || null,
        personalization_score: draft.personalization_score,
        spam_risk: draft.spam_risk,
      });
      toast.success("Draft saved");
      setDraft(null);
      setCtx("");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
  }

  const busy = ai.isPending;

  return (
    <Modal open={open} onClose={onClose} title="AI Email Copilot">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-2">Email type</p>
          <div className="grid grid-cols-3 gap-2">
            {COPILOT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setEmailType(t.id)}
                className={`text-left rounded-lg border p-2.5 transition ${
                  emailType === t.id
                    ? "border-border-strong bg-surface"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <p className="text-[12.5px] font-medium text-foreground">{t.label}</p>
                <p className="text-[11px] text-foreground-subtle mt-0.5">{t.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Tone">
            <Select value={tone} onChange={(e) => setTone(e.target.value)}>
              {COPILOT_TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Length">
            <Select value={length} onChange={(e) => setLength(e.target.value as any)}>
              {COPILOT_LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label} · {l.hint}</option>)}
            </Select>
          </Field>
          <Field label="Lead (optional)">
            <Select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">—</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.stage} · {l.id.slice(0, 8)}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Company (for research personalization)">
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">—</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>

        <Field label="Extra instructions (optional)">
          <TextArea rows={2} value={ctx} onChange={(e) => setCtx(e.target.value)}
            placeholder="Anything specific — the trigger event, product angle, prior conversation…" />
        </Field>

        <div className="flex justify-end gap-2">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleGenerate} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy ? "Generating…" : draft ? "Regenerate" : "Generate"}
          </PrimaryBtn>
        </div>

        {draft && (
          <div className="space-y-3 border-t border-border pt-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground-subtle">Subject</p>
              <TextInput value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              {draft.subject_variants && draft.subject_variants.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {draft.subject_variants.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDraft({ ...draft, subject: v })}
                      className="text-[11px] px-2 py-1 rounded-md border border-border bg-surface text-foreground-muted hover:text-foreground hover:border-border-strong transition"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground-subtle">Body preview</p>
              <TextArea rows={9} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </div>

            {draft.cta_suggestions && draft.cta_suggestions.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1.5">CTA suggestions</p>
                <div className="flex flex-wrap gap-1.5">
                  {[draft.cta, ...draft.cta_suggestions].filter(Boolean).map((c, i) => (
                    <span key={i} className="text-[11px] px-2 py-1 rounded-md border border-border bg-surface text-foreground-muted">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-md border border-border bg-surface p-2">
                <span className="text-foreground-subtle">Tone</span>
                <p className="text-foreground font-medium mt-0.5">{draft.tone}</p>
              </div>
              <div className="rounded-md border border-border bg-surface p-2">
                <span className="text-foreground-subtle">Personalization</span>
                <p className="text-foreground font-medium mt-0.5">{draft.personalization_score}</p>
              </div>
              <div className="rounded-md border border-border bg-surface p-2">
                <span className="text-foreground-subtle">Spam risk</span>
                <p className="text-foreground font-medium mt-0.5">{draft.spam_risk}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <GhostBtn onClick={() => setDraft(null)}>Discard</GhostBtn>
              <PrimaryBtn onClick={handleSave} disabled={insert.isPending || !draft.subject}>
                {insert.isPending ? "Saving…" : "Save as draft"}
              </PrimaryBtn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
