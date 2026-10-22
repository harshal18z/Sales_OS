import { createFileRoute, Link } from "@/lib/router-compat";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Copy, FileText, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Field,
  Modal,
  PageHeader,
  PrimaryBtn,
  Select,
  TextArea,
  TextInput,
} from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/templates")({
  head: () => ({ meta: [{ title: "Templates — SalesOS AI" }] }),
  component: TemplatesPage,
});

type Template = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};
const CATEGORIES = [
  "general",
  "cold outreach",
  "follow-up",
  "meeting",
  "proposal",
  "re-engagement",
];

function TemplatesPage() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [query, setQuery] = useState("");
  const templates = useQuery({
    queryKey: ["message-templates", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("message_templates" as never) as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });
  const save = useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      category: string;
      subject: string;
      body: string;
    }) => {
      if (!workspaceId) throw new Error("Select a workspace first");
      const table = supabase.from("message_templates" as never) as any;
      const values = {
        name: input.name.trim(),
        category: input.category,
        subject: input.subject,
        body: input.body,
        updated_at: new Date().toISOString(),
      };
      const result = input.id
        ? await table
            .update(values)
            .eq("id", input.id)
            .eq("workspace_id", workspaceId)
            .select()
            .single()
        : await table
            .insert({ ...values, workspace_id: workspaceId })
            .select()
            .single();
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates", workspaceId] });
      toast.success("Template saved");
      setModal(false);
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("message_templates" as never) as any)
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-templates", workspaceId] });
      toast.success("Template deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rows = (templates.data ?? []).filter((row) =>
    `${row.name} ${row.category} ${row.subject} ${row.body}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function create() {
    setEditing(null);
    setModal(true);
  }
  function edit(row: Template) {
    setEditing(row);
    setModal(true);
  }
  async function copy(row: Template) {
    try {
      await navigator.clipboard.writeText(
        [row.subject ? `Subject: ${row.subject}` : "", row.body].filter(Boolean).join("\n\n"),
      );
      toast.success("Template copied");
    } catch {
      toast.error("Clipboard access is unavailable in this browser.");
    }
  }
  return (
    <div className="min-h-full">
      <PageHeader
        title="Templates"
        subtitle="Shared email copy for your team. Use variables such as {{first_name}}, {{company}}, and {{meeting_link}}."
        action={
          <PrimaryBtn onClick={create}>
            <Plus className="h-3.5 w-3.5" /> New template
          </PrimaryBtn>
        }
      />
      <main className="max-w-6xl space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            className="max-w-sm"
          />
          <span className="text-[11px] text-foreground-subtle">
            {rows.length} template{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        {templates.isLoading ? (
          <p className="text-[13px] text-foreground-muted">Loading templates…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-foreground-subtle" />
            <h2 className="mt-3 text-[14px] font-semibold">
              {query ? "No matching templates" : "No templates yet"}
            </h2>
            <p className="mt-1 text-[12px] text-foreground-muted">
              Create reusable copy for your team’s outreach.
            </p>
            {!query && (
              <button onClick={create} className="mt-4 text-[12px] underline underline-offset-4">
                Create a template
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((row) => (
              <article key={row.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-muted">
                    <Mail className="h-4 w-4 text-foreground-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[13px] font-semibold">{row.name}</h2>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] capitalize text-foreground-muted">
                        {row.category}
                      </span>
                    </div>
                    {row.subject && (
                      <p className="mt-2 truncate text-[11px] font-medium">{row.subject}</p>
                    )}
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[11.5px] leading-5 text-foreground-muted">
                      {row.body}
                    </p>
                    <p className="mt-3 text-[10px] text-foreground-subtle">
                      Updated {new Date(row.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                  <Link
                    to="/emails"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[10.5px] text-foreground-muted"
                  >
                    <Mail className="h-3 w-3" /> Open email
                  </Link>
                  <button
                    onClick={() => copy(row)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[10.5px] text-foreground-muted"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <button
                    onClick={() => edit(row)}
                    className="rounded-md border border-border p-1.5 text-foreground-muted"
                    aria-label="Edit template"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this template?")) remove.mutate(row.id);
                    }}
                    className="rounded-md border border-border p-1.5 text-foreground-muted hover:text-destructive"
                    aria-label="Delete template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <TemplateEditor
        key={editing?.id ?? (modal ? "new" : "closed")}
        open={modal}
        initial={editing}
        saving={save.isPending}
        onClose={() => {
          setModal(false);
          setEditing(null);
        }}
        onSave={(values) => save.mutate({ ...values, id: editing?.id })}
      />
    </div>
  );
}

function TemplateEditor({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Template | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: { name: string; category: string; subject: string; body: string }) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || "general");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [body, setBody] = useState(initial?.body || "");
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ name, category, subject, body });
  }
  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit template" : "New template"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
          />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <TextInput
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Optional subject line"
          />
        </Field>
        <Field label="Email body">
          <TextArea
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi {{first_name}}, …"
            required
          />
        </Field>
        <p className="text-[10px] text-foreground-subtle">
          Personalization variables are kept as written; the email composer can replace them before
          sending.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-border px-3 text-xs"
          >
            Cancel
          </button>
          <PrimaryBtn type="submit" disabled={saving || !name.trim() || !body.trim()}>
            {saving ? "Saving…" : "Save template"}
          </PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}
