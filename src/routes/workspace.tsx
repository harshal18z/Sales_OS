import { createFileRoute, Link } from "@/lib/router-compat";
import { useState } from "react";
import { Building2, Check, Plus, Search } from "lucide-react";
import { AuthShell, Button } from "@/components/auth/shell";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Choose a workspace — SalesOS AI" },
      { name: "description", content: "Select or create a SalesOS AI workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspacePage,
});

const workspaces = [
  { id: "acme", name: "Acme Corp", role: "Owner", members: 24, initial: "A", recent: true },
  { id: "north", name: "Northwind Growth", role: "Admin", members: 12, initial: "N" },
  { id: "field", name: "Fieldwire Sales", role: "Member", members: 48, initial: "F" },
];

function WorkspacePage() {
  const [selected, setSelected] = useState<string>("acme");
  const [query, setQuery] = useState("");
  const filtered = workspaces.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AuthShell>
      <div>
        <h1 className="text-heading">Choose a workspace</h1>
        <p className="text-body text-foreground-muted mt-2">
          You're signed in as <span className="text-foreground font-medium">alex@acme.com</span>.
        </p>

        <div className="mt-8 flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/5 transition-all">
          <Search className="h-4 w-4 text-foreground-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-foreground-subtle"
          />
          <span className="kbd">⌘K</span>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-caption">No workspaces found</div>
            </div>
          ) : (
            filtered.map((w, i) => {
              const active = selected === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelected(w.id)}
                  className={`w-full flex items-center gap-3 px-4 h-16 text-left transition-colors ${
                    i > 0 ? "border-t border-border" : ""
                  } ${active ? "bg-surface-muted" : "hover:bg-surface-muted/60"}`}
                >
                  <div className="h-9 w-9 rounded-lg bg-background border border-border grid place-items-center text-[13px] font-semibold">
                    {w.initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium truncate">{w.name}</span>
                      {w.recent && (
                        <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-foreground-subtle">
                          Recent
                        </span>
                      )}
                    </div>
                    <div className="text-caption mt-0.5">
                      {w.role} · {w.members} members
                    </div>
                  </div>
                  <div
                    className={`h-4 w-4 rounded-full grid place-items-center transition-all ${
                      active ? "bg-foreground text-background" : "border border-border"
                    }`}
                  >
                    {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <Link
          to="/workspace-new"
          className="mt-3 w-full h-14 rounded-2xl border border-dashed border-border hover:border-border-strong hover:bg-surface-muted/50 transition-colors flex items-center gap-3 px-4 text-left group"
        >
          <div className="h-9 w-9 rounded-lg border border-border bg-surface grid place-items-center">
            <Plus className="h-4 w-4 text-foreground-muted" />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-medium">Create a new workspace</div>
            <div className="text-caption">For a new team or organization</div>
          </div>
        </Link>

        <div className="mt-8">
          <Link to="/onboarding">
            <Button size="lg" full>
              Continue to {workspaces.find((w) => w.id === selected)?.name ?? "workspace"}
            </Button>
          </Link>
        </div>

        <p className="text-caption text-center mt-6 flex items-center justify-center gap-1.5">
          <Building2 className="h-3 w-3" />
          Not seeing your team? Ask your admin for an invite.
        </p>
      </div>
    </AuthShell>
  );
}
