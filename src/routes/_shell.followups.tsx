import { createFileRoute, Link } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { Check, Clock3, CornerDownRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteRow, useInsertRow, useLeads, useTasks, useUpdateRow } from "@/hooks/use-data";
import { useWorkspace } from "@/hooks/use-workspace";
import { EmptyState, Field, Modal, PageHeader, PrimaryBtn, Select, TextArea, TextInput } from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/followups")({
  head: () => ({ meta: [{ title: "Follow-ups — SalesOS AI" }] }),
  component: FollowupsPage,
});

function FollowupsPage() {
  const { workspaceId } = useWorkspace();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: leads = [] } = useLeads();
  const insert = useInsertRow("tasks", "tasks");
  const update = useUpdateRow("tasks", "tasks");
  const remove = useDeleteRow("tasks", "tasks");
  const [filter, setFilter] = useState("open");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const leadMap = useMemo(() => new Map((leads as any[]).map((lead) => [lead.id, lead])), [leads]);
  const visible = useMemo(() => (tasks as any[]).filter((task) => filter === "all" || (filter === "open" ? task.status !== "completed" : task.status === "completed")), [filter, tasks]);
  const overdue = visible.filter((task: any) => task.status !== "completed" && task.due_date && new Date(task.due_date) < new Date()).length;

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await insert.mutateAsync({ title: title.trim(), description: description.trim() || null, due_date: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null, priority, status: "open" } as never);
      setTitle(""); setDescription(""); setDueDate(""); setPriority("medium"); setOpen(false); toast.success("Follow-up created");
    } catch (error) { toast.error((error as Error).message); }
  }
  async function toggle(task: any) {
    try { await update.mutateAsync({ id: task.id, values: { status: task.status === "completed" ? "open" : "completed" } }); }
    catch (error) { toast.error((error as Error).message); }
  }
  async function deleteTask(id: string) {
    if (!confirm("Delete this follow-up?")) return;
    try { await remove.mutateAsync(id); toast.success("Follow-up deleted"); }
    catch (error) { toast.error((error as Error).message); }
  }

  return <div className="min-h-full">
    <PageHeader title="Follow-ups" subtitle={`${tasks.filter((t: any) => t.status !== "completed").length} open · ${overdue} overdue`} action={<PrimaryBtn onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> New follow-up</PrimaryBtn>} />
    <main className="max-w-5xl space-y-4 p-6">
      <div className="flex items-center gap-2"><Select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="open">Open</option><option value="completed">Completed</option><option value="all">All follow-ups</option></Select><span className="text-[12px] text-foreground-subtle">Tasks are shared with your workspace.</span></div>
      {isLoading ? <p className="text-[13px] text-foreground-muted">Loading follow-ups…</p> : visible.length === 0 ? <div className="rounded-xl border border-border bg-surface"><EmptyState icon={CornerDownRight} title={filter === "completed" ? "Nothing completed yet" : "Nothing needs follow-up"} description="Create a task for a lead or deal so the next step stays visible." action={<PrimaryBtn onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add a follow-up</PrimaryBtn>} /></div> : <div className="space-y-2">{visible.map((task: any) => {
        const lead = task.lead_id ? leadMap.get(task.lead_id) : null;
        const isOverdue = task.status !== "completed" && task.due_date && new Date(task.due_date) < new Date();
        return <article key={task.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
          <button onClick={() => toggle(task)} aria-label={task.status === "completed" ? "Reopen task" : "Complete task"} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${task.status === "completed" ? "border-foreground bg-foreground text-background" : "border-border text-transparent hover:border-foreground"}`}><Check className="h-3 w-3" /></button>
          <div className="min-w-0 flex-1"><h2 className={`text-[13px] font-medium ${task.status === "completed" ? "text-foreground-muted line-through" : "text-foreground"}`}>{task.title}</h2>{task.description && <p className="mt-1 text-[12px] leading-5 text-foreground-muted">{task.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-foreground-subtle">{task.due_date && <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-destructive" : ""}`}><Clock3 className="h-3 w-3" />{isOverdue ? "Overdue · " : "Due "}{new Date(task.due_date).toLocaleDateString()}</span>}<span className="capitalize">{task.priority || "medium"} priority</span>{lead && <Link to={`/lead/${lead.id}`} className="text-foreground-muted hover:text-foreground">{lead.full_name || lead.name || "Open lead"}</Link>}{task.deal_id && <Link to="/crm" className="text-foreground-muted hover:text-foreground">Open deal</Link>}</div></div>
          <button onClick={() => deleteTask(task.id)} className="rounded p-1 text-foreground-subtle hover:text-destructive" aria-label="Delete follow-up"><Trash2 className="h-3.5 w-3.5" /></button>
        </article>;
      })}</div>}
      {!workspaceId && <p className="text-[12px] text-destructive">Choose a workspace to manage follow-ups.</p>}
    </main>
    <Modal open={open} onClose={() => setOpen(false)} title="Create follow-up"><form onSubmit={createTask} className="space-y-4"><Field label="Task"><TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Send pricing after discovery call" required /></Field><Field label="Details"><TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add context for the next step" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Due date"><TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field><Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md border border-border px-3 text-xs">Cancel</button><PrimaryBtn type="submit" disabled={!title.trim() || insert.isPending}>{insert.isPending ? "Saving…" : "Create follow-up"}</PrimaryBtn></div></form></Modal>
  </div>;
}
