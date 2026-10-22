import { createFileRoute } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calendar, CheckSquare, Plus, Sparkles, Square, Trash2 } from "lucide-react";
import { useAIJobs, useDeleteRow, useInsertRow, useMeetings, useUpdateRow } from "@/hooks/use-data";
import { useCalendarEvents, useGoogleStatus, useCalendarCancel } from "@/hooks/use-google";
import { useAIMeetingPrep, useAIMeetingRecap } from "@/hooks/use-ai";
import {
  EmptyState,
  Field,
  GhostBtn,
  Modal,
  PageHeader,
  PrimaryBtn,
  Select,
  SkeletonList,
  TextArea,
  TextInput,
} from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/meetings")({
  head: () => ({ meta: [{ title: "Meetings — SalesOS AI" }] }),
  component: MeetingsPage,
});

const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MeetingsPage() {
  const { data: meetings = [], isLoading } = useMeetings();
  const { data: gstatus } = useGoogleStatus();
  const now7 = useMemo(() => {
    const from = new Date();
    const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return { timeMin: from.toISOString(), timeMax: to.toISOString() };
  }, []);
  const gcal = useCalendarEvents(now7, !!gstatus?.calendar);
  const cancelEvent = useCalendarCancel();
  const insert = useInsertRow("meetings", "meetings");
  const update = useUpdateRow("meetings", "meetings");
  const del = useDeleteRow("meetings", "meetings");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notes, setNotes] = useState("");

  const now = new Date();
  const upcoming = (meetings as any[]).filter((m) => new Date(m.starts_at) >= now);
  const past = (meetings as any[]).filter((m) => new Date(m.starts_at) < now);

  const selected =
    (meetings as any[]).find((m) => m.id === selectedId) ?? upcoming[0] ?? past[0] ?? null;

  useMemo(() => {
    setNotes(selected?.notes ?? "");
  }, [selected?.id]);

  async function saveNotes() {
    if (!selected) return;
    try {
      await update.mutateAsync({ id: selected.id, values: { notes } });
      toast.success("Notes saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleActionItem(idx: number) {
    if (!selected) return;
    const items = [...(selected.action_items ?? [])];
    items[idx] = { ...items[idx], done: !items[idx].done };
    try {
      await update.mutateAsync({ id: selected.id, values: { action_items: items as never } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function setStatus(status: string) {
    if (!selected) return;
    try {
      await update.mutateAsync({ id: selected.id, values: { status } });
      toast.success(status);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this meeting?")) return;
    try {
      await del.mutateAsync(id);
      setSelectedId(null);
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Meetings"
        subtitle={`${upcoming.length} upcoming · ${past.length} past`}
        action={
          <PrimaryBtn onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Schedule meeting
          </PrimaryBtn>
        }
      />

      <div className="grid grid-cols-12 gap-0 min-h-[calc(100vh-8rem)]">
        <aside className="col-span-12 lg:col-span-4 border-r border-border bg-surface/40">
          <div className="p-4">
            {isLoading ? (
              <SkeletonList count={4} />
            ) : meetings.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No meetings yet"
                description="Schedule your first meeting to see it here."
                action={
                  <PrimaryBtn onClick={() => setCreating(true)}>
                    <Plus className="h-3.5 w-3.5" /> Schedule
                  </PrimaryBtn>
                }
              />
            ) : (
              <>
                {gstatus?.calendar && (
                  <div className="mb-5">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle px-1 mb-2">
                      Google Calendar · next 7d
                    </p>
                    {gcal.isLoading ? (
                      <SkeletonList count={3} />
                    ) : ((gcal.data as any)?.events ?? []).length === 0 ? (
                      <p className="text-[12px] text-foreground-subtle px-1">
                        No upcoming Google events.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {((gcal.data as any).events as any[]).slice(0, 10).map((e) => (
                          <div
                            key={e.id}
                            className="rounded-lg border border-border bg-surface p-3"
                          >
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium text-foreground truncate flex-1">
                                {e.summary || "(no title)"}
                              </p>
                              <button
                                onClick={async () => {
                                  if (!confirm("Cancel this event?")) return;
                                  try {
                                    await cancelEvent.mutateAsync({ eventId: e.id });
                                    toast.success("Cancelled");
                                  } catch (err) {
                                    toast.error((err as Error).message);
                                  }
                                }}
                                className="text-[11px] text-foreground-subtle hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="text-[11.5px] text-foreground-subtle mt-0.5">
                              {e.start ? fmtDate(e.start) : ""}
                              {e.location ? ` · ${e.location}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[11px] uppercase tracking-wider text-foreground-subtle px-1 mb-2">
                  Upcoming
                </p>
                <div className="space-y-1.5">
                  {upcoming.map((m: any) => (
                    <MeetingItem
                      key={m.id}
                      m={m}
                      active={selected?.id === m.id}
                      onClick={() => setSelectedId(m.id)}
                    />
                  ))}
                  {upcoming.length === 0 && (
                    <p className="text-[12px] text-foreground-subtle px-1">Nothing upcoming.</p>
                  )}
                </div>
                {past.length > 0 && (
                  <>
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle px-1 mt-5 mb-2">
                      Past
                    </p>
                    <div className="space-y-1.5">
                      {past.slice(0, 20).map((m: any) => (
                        <MeetingItem
                          key={m.id}
                          m={m}
                          active={selected?.id === m.id}
                          onClick={() => setSelectedId(m.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        <div className="col-span-12 lg:col-span-8">
          <div className="p-6">
            {!selected ? (
              <div className="text-[12px] text-foreground-subtle">Select a meeting.</div>
            ) : (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[18px] font-semibold text-foreground truncate">
                      {selected.title}
                    </h2>
                    <p className="text-[12px] text-foreground-muted mt-0.5">
                      {fmtDate(selected.starts_at)}
                      {selected.location ? ` · ${selected.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selected.status ?? "scheduled"}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    <GhostBtn onClick={() => handleDelete(selected.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </GhostBtn>
                  </div>
                </div>

                {selected.description && (
                  <p className="text-[13px] text-foreground-muted">{selected.description}</p>
                )}

                <AICopilotPanel meeting={selected} />

                {Array.isArray(selected.agenda) &&
                  selected.agenda.length > 0 &&
                  !selected.ai_prep && (
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">
                        Agenda
                      </p>
                      <ol className="space-y-1.5 list-decimal list-inside">
                        {selected.agenda.map((a: any, i: number) => (
                          <li key={i} className="text-[13px] text-foreground">
                            {typeof a === "string" ? a : (a.title ?? "Item")}
                            {typeof a === "object" && a.duration && (
                              <span className="text-foreground-subtle text-[11px] ml-2">
                                {a.duration}m
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                      Notes
                    </p>
                    <PrimaryBtn onClick={saveNotes}>Save notes</PrimaryBtn>
                  </div>
                  <TextArea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                {Array.isArray(selected.action_items) && selected.action_items.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">
                      Action items
                    </p>
                    <div className="space-y-1.5">
                      {selected.action_items.map((it: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => toggleActionItem(i)}
                          className="w-full flex items-center gap-2 text-left py-1 group"
                        >
                          {it.done ? (
                            <CheckSquare className="h-3.5 w-3.5 text-foreground shrink-0" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
                          )}
                          <span
                            className={`text-[13px] ${it.done ? "text-foreground-subtle line-through" : "text-foreground"}`}
                          >
                            {typeof it === "string" ? it : (it.text ?? "Task")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">
                    Timeline
                  </p>
                  <p className="text-[12px] text-foreground-muted">
                    Created {fmtDate(selected.created_at)}
                  </p>
                  {selected.updated_at !== selected.created_at && (
                    <p className="text-[12px] text-foreground-muted mt-1">
                      Updated {fmtDate(selected.updated_at)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MeetingForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={async (v) => {
          try {
            await insert.mutateAsync(v);
            toast.success("Scheduled");
            setCreating(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function MeetingItem({ m, active, onClick }: { m: any; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-2.5 transition ${
        active
          ? "border-border-strong bg-surface"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <p className="text-[13px] font-medium text-foreground truncate">{m.title}</p>
      <p className="text-[11px] text-foreground-subtle mt-0.5">{fmtDate(m.starts_at)}</p>
    </button>
  );
}

function MeetingForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: any) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(
    new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Schedule meeting">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          const starts = new Date(startsAt);
          const ends = new Date(starts.getTime() + duration * 60 * 1000);
          await onSubmit({
            title,
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            description: description || null,
            location: location || null,
            status: "scheduled",
            agenda: [],
            action_items: [],
            attendees: [],
          });
          setSubmitting(false);
          setTitle("");
          setDescription("");
          setLocation("");
        }}
        className="space-y-3"
      >
        <Field label="Title">
          <TextInput required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts at">
            <TextInput
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label="Duration (min)">
            <TextInput
              type="number"
              min={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Location / Link">
          <TextInput value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Description">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn type="submit" disabled={submitting || !title}>
            Schedule
          </PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}

function AICopilotPanel({ meeting }: { meeting: any }) {
  const prep = useAIMeetingPrep();
  const recap = useAIMeetingRecap();
  const { data: jobs = [] } = useAIJobs();
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  const activePrep = (jobs as any[]).find(
    (j) =>
      j.entity_id === meeting.id &&
      j.kind === "meeting_prep" &&
      (j.status === "queued" || j.status === "running"),
  );
  const activeRecap = (jobs as any[]).find(
    (j) =>
      j.entity_id === meeting.id &&
      j.kind === "meeting_recap" &&
      (j.status === "queued" || j.status === "running"),
  );

  const isPast = new Date(meeting.starts_at) < new Date() || meeting.status === "completed";
  const p = meeting.ai_prep as any | null;
  const s = meeting.ai_summary as any | null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-foreground" />
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
            AI Meeting Copilot
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isPast && (
            <PrimaryBtn
              onClick={() => prep.mutate({ meetingId: meeting.id, force: !!p })}
              disabled={!!activePrep || prep.isPending}
            >
              {activePrep ? "Generating…" : p ? "Refresh prep" : "Generate prep"}
            </PrimaryBtn>
          )}
          {isPast && (
            <PrimaryBtn
              onClick={() =>
                recap.mutate({
                  meetingId: meeting.id,
                  transcript: transcript || undefined,
                  force: !!s,
                })
              }
              disabled={!!activeRecap || recap.isPending}
            >
              {activeRecap ? "Generating…" : s ? "Refresh recap" : "Generate recap"}
            </PrimaryBtn>
          )}
        </div>
      </div>

      {(activePrep || activeRecap) && (
        <div>
          <div className="h-1 w-full rounded bg-border overflow-hidden">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${(activePrep ?? activeRecap)?.progress ?? 0}%` }}
            />
          </div>
          <p className="text-[11px] text-foreground-subtle mt-1.5">
            {((activePrep ?? activeRecap)?.output as any)?.stage ?? "Working…"}
          </p>
        </div>
      )}

      {!isPast && !p && !activePrep && (
        <p className="text-[12px] text-foreground-subtle">
          Generate an AI brief grounded in this company's research, the lead's intelligence and the
          meeting context — agenda, discovery questions, objections, demo flow and pricing
          talk-track.
        </p>
      )}

      {isPast && !s && !activeRecap && (
        <>
          <p className="text-[12px] text-foreground-subtle">
            Generate a recap from your notes: summary, action items, follow-up tasks and a
            ready-to-send follow-up email.
          </p>
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="text-[11px] text-foreground-subtle hover:text-foreground underline underline-offset-2"
          >
            {showTranscript ? "Use notes instead" : "Paste transcript (optional)"}
          </button>
          {showTranscript && (
            <TextArea
              rows={4}
              placeholder="Paste transcript or additional context…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          )}
        </>
      )}

      {p && !isPast && <PrepView p={p} />}
      {s && isPast && <RecapView s={s} />}
    </div>
  );
}

function PrepView({ p }: { p: any }) {
  return (
    <div className="space-y-4">
      {p.brief && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">
            Brief
          </p>
          <p className="text-[13px] text-foreground">{p.brief}</p>
        </div>
      )}
      {Array.isArray(p.agenda) && p.agenda.length > 0 && (
        <AISection title="Agenda">
          <ol className="space-y-1 list-decimal list-inside">
            {p.agenda.map((a: any, i: number) => (
              <li key={i} className="text-[13px] text-foreground">
                {a.title}
                {a.minutes ? (
                  <span className="text-foreground-subtle text-[11px] ml-2">{a.minutes}m</span>
                ) : null}
              </li>
            ))}
          </ol>
        </AISection>
      )}
      {Array.isArray(p.discussion_points) && p.discussion_points.length > 0 && (
        <AIBullets title="Discussion points" items={p.discussion_points} />
      )}
      {Array.isArray(p.discovery_questions) && p.discovery_questions.length > 0 && (
        <AIBullets title="Discovery questions" items={p.discovery_questions} />
      )}
      {Array.isArray(p.objections) && p.objections.length > 0 && (
        <AISection title="Objection handling">
          <div className="space-y-2">
            {p.objections.map((o: any, i: number) => (
              <div key={i}>
                <p className="text-[12.5px] font-medium text-foreground">{o.objection}</p>
                <p className="text-[12.5px] text-foreground-muted">{o.response}</p>
              </div>
            ))}
          </div>
        </AISection>
      )}
      {Array.isArray(p.demo_flow) && p.demo_flow.length > 0 && (
        <AISection title="Demo flow">
          <ol className="space-y-1 list-decimal list-inside">
            {p.demo_flow.map((d: any, i: number) => (
              <li key={i} className="text-[13px] text-foreground">
                {d.step}
                {d.focus ? (
                  <span className="text-foreground-subtle text-[11px] ml-2">— {d.focus}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </AISection>
      )}
      {p.pricing_discussion && (
        <AISection title="Pricing discussion">
          {p.pricing_discussion.positioning && (
            <p className="text-[13px] text-foreground mb-2">{p.pricing_discussion.positioning}</p>
          )}
          {Array.isArray(p.pricing_discussion.anchors) &&
            p.pricing_discussion.anchors.length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] text-foreground-subtle">Anchors</p>
                <ul className="list-disc list-inside text-[12.5px] text-foreground">
                  {p.pricing_discussion.anchors.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          {Array.isArray(p.pricing_discussion.objection_responses) &&
            p.pricing_discussion.objection_responses.length > 0 && (
              <div>
                <p className="text-[11px] text-foreground-subtle">If they push back</p>
                <ul className="list-disc list-inside text-[12.5px] text-foreground">
                  {p.pricing_discussion.objection_responses.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
        </AISection>
      )}
      {Array.isArray(p.risks) && p.risks.length > 0 && <AIBullets title="Risks" items={p.risks} />}
      {Array.isArray(p.success_criteria) && p.success_criteria.length > 0 && (
        <AIBullets title="Success criteria" items={p.success_criteria} />
      )}
    </div>
  );
}

function RecapView({ s }: { s: any }) {
  return (
    <div className="space-y-4">
      {s.summary && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">
            Summary
          </p>
          <p className="text-[13px] text-foreground whitespace-pre-wrap">{s.summary}</p>
        </div>
      )}
      {Array.isArray(s.key_decisions) && s.key_decisions.length > 0 && (
        <AIBullets title="Key decisions" items={s.key_decisions} />
      )}
      {Array.isArray(s.action_items) && s.action_items.length > 0 && (
        <AISection title="Action items">
          <ul className="space-y-1">
            {s.action_items.map((a: any, i: number) => (
              <li key={i} className="text-[13px] text-foreground">
                • {a.text}
                {a.owner ? (
                  <span className="text-foreground-subtle text-[11px] ml-2">@{a.owner}</span>
                ) : null}
                {a.due ? (
                  <span className="text-foreground-subtle text-[11px] ml-2">· {a.due}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </AISection>
      )}
      {Array.isArray(s.follow_up_tasks) && s.follow_up_tasks.length > 0 && (
        <AISection title="Follow-up tasks">
          <ul className="space-y-1">
            {s.follow_up_tasks.map((t: any, i: number) => (
              <li key={i} className="text-[13px] text-foreground">
                • {t.title}
                {t.priority ? (
                  <span className="text-foreground-subtle text-[11px] ml-2">[{t.priority}]</span>
                ) : null}
              </li>
            ))}
          </ul>
        </AISection>
      )}
      {s.follow_up_email && (
        <AISection title="Follow-up email">
          <p className="text-[12.5px] font-medium text-foreground mb-1">
            Subject: {s.follow_up_email.subject}
          </p>
          <p className="text-[13px] text-foreground whitespace-pre-wrap">
            {s.follow_up_email.body}
          </p>
          <div className="pt-2">
            <GhostBtn
              onClick={() => {
                navigator.clipboard.writeText(
                  `Subject: ${s.follow_up_email.subject}\n\n${s.follow_up_email.body}`,
                );
                toast.success("Copied email");
              }}
            >
              Copy email
            </GhostBtn>
          </div>
        </AISection>
      )}
      {s.sentiment && (
        <p className="text-[11px] text-foreground-subtle">Sentiment: {s.sentiment}</p>
      )}
    </div>
  );
}

function AISection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function AIBullets({ title, items }: { title: string; items: string[] }) {
  return (
    <AISection title={title}>
      <ul className="space-y-1 list-disc list-inside">
        {items.map((x, i) => (
          <li key={i} className="text-[13px] text-foreground">
            {x}
          </li>
        ))}
      </ul>
    </AISection>
  );
}
