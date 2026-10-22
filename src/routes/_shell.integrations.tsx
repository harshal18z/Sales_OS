import { createFileRoute, Link } from "@/lib/router-compat";
import { useState } from "react";
import {
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  Mail,
  Calendar,
  Database,
  Upload,
  Plus,
  RefreshCw,
  AlertCircle,
  Building2,
  Users,
  Target,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, GhostBtn, PageHeader, PrimaryBtn } from "@/components/app/data-ui";
import {
  useConnectCalendar,
  useConnectGmail,
  useDisconnect,
  useGoogleStatus,
} from "@/hooks/use-google";
import {
  useCRMIntegrations,
  useManualCRMSync,
  useUpsertCRMIntegration,
  type CRMProvider,
  type CRMIntegrationRow,
} from "@/hooks/use-crm";
import { CSVImportModal, type EntityKey } from "@/components/crm/csv-import-modal";

export const Route = createFileRoute("/_shell/integrations")({
  head: () => ({ meta: [{ title: "Integrations — SalesOS AI" }] }),
  component: IntegrationsPage,
});

const CRM_META: Record<CRMProvider, { name: string; description: string }> = {
  hubspot: {
    name: "HubSpot",
    description:
      "Sync companies, contacts, deals, and activities every 5 minutes with two-way sync.",
  },
  salesforce: {
    name: "Salesforce",
    description:
      "Sync accounts, contacts, opportunities, and tasks bidirectionally with conflict detection.",
  },
  pipedrive: {
    name: "Pipedrive",
    description: "Sync organizations, persons, deals, and activities. Manual and scheduled sync.",
  },
};

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function IntegrationsPage() {
  const { data: status, isLoading } = useGoogleStatus();
  const connectGmail = useConnectGmail();
  const connectCal = useConnectCalendar();
  const disconnectGmail = useDisconnect("google_mail");
  const disconnectCal = useDisconnect("google_calendar");

  const { data: crm = [] } = useCRMIntegrations();
  const upsertCRM = useUpsertCRMIntegration();
  const manualSync = useManualCRMSync();

  const [importEntity, setImportEntity] = useState<EntityKey | null>(null);

  async function runConnect(kind: "gmail" | "calendar") {
    try {
      if (kind === "gmail") await connectGmail.mutateAsync();
      else await connectCal.mutateAsync();
      toast.success("Connected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function runDisconnect(kind: "gmail" | "calendar") {
    if (!confirm("Disconnect this integration?")) return;
    try {
      if (kind === "gmail") await disconnectGmail.mutateAsync();
      else await disconnectCal.mutateAsync();
      toast.success("Disconnected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleCRMConnect(provider: CRMProvider) {
    // OAuth is not configured in this environment. Mark as pending so the
    // UI reflects intent, and surface a clear message to the user.
    try {
      await upsertCRM.mutateAsync({
        provider,
        status: "pending",
        config: {
          last_error:
            "OAuth setup required. A workspace admin must configure the CRM connector before syncing can begin.",
        },
      });
      toast.message(`${CRM_META[provider].name} setup required`, {
        description:
          "OAuth isn't configured yet. You can keep importing data via CSV or manual entry, and connect this CRM later.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleCRMDisconnect(provider: CRMProvider) {
    if (!confirm(`Disconnect ${CRM_META[provider].name}?`)) return;
    try {
      await upsertCRM.mutateAsync({
        provider,
        status: "disconnected",
        config: { last_error: null },
      });
      toast.success("Disconnected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleManualSync(provider: CRMProvider) {
    try {
      await manualSync.mutateAsync(provider);
      toast.success("Sync complete");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Integrations"
        subtitle="Connect your stack. Email, calendar, CRM — all in one place."
      />

      <div className="p-6 max-w-4xl space-y-8">
        {/* Google */}
        <section>
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">Google</p>
          <div className="space-y-3">
            <IntegrationCard
              icon={Mail}
              name="Gmail"
              description="Send, reply, forward, draft, schedule, and read inbox/sent/drafts. Track replies."
              connected={!!status?.gmail}
              loading={isLoading || connectGmail.isPending || disconnectGmail.isPending}
              onConnect={() => runConnect("gmail")}
              onDisconnect={() => runDisconnect("gmail")}
            />
            <IntegrationCard
              icon={Calendar}
              name="Google Calendar"
              description="Read meetings, create/update/cancel events, check availability, and set reminders."
              connected={!!status?.calendar}
              loading={isLoading || connectCal.isPending || disconnectCal.isPending}
              onConnect={() => runConnect("calendar")}
              onDisconnect={() => runDisconnect("calendar")}
            />
          </div>
        </section>

        {/* CRM */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">CRM</p>
            <p className="text-[11px] text-foreground-subtle">Optional · Configure later</p>
          </div>
          <div className="space-y-3">
            {crm.map((row) => (
              <CRMCard
                key={row.provider}
                row={row}
                busy={upsertCRM.isPending || manualSync.isPending}
                onConnect={() => handleCRMConnect(row.provider)}
                onDisconnect={() => handleCRMDisconnect(row.provider)}
                onSync={() => handleManualSync(row.provider)}
              />
            ))}
          </div>
          {crm.every((r) => r.status !== "connected") && (
            <div className="mt-3 rounded-lg border border-border bg-surface-muted/40 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-foreground-muted mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                No CRM connected. SalesOS runs on your workspace data — import via CSV or add
                records manually below. You can connect a CRM anytime.
              </p>
            </div>
          )}
        </section>

        {/* Data import & manual entry */}
        <section>
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">Data</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DataCard
              icon={Building2}
              label="Companies"
              onImport={() => setImportEntity("companies")}
              manualHref="/companies"
            />
            <DataCard
              icon={Users}
              label="Contacts"
              onImport={() => setImportEntity("contacts")}
              manualHref="/leads"
            />
            <DataCard
              icon={Target}
              label="Leads"
              onImport={() => setImportEntity("leads")}
              manualHref="/leads"
            />
            <DataCard
              icon={DollarSign}
              label="Deals"
              onImport={() => setImportEntity("crm_deals")}
              manualHref="/crm"
            />
          </div>
        </section>
      </div>

      {importEntity && (
        <CSVImportModal
          open={!!importEntity}
          onClose={() => setImportEntity(null)}
          entity={importEntity}
        />
      )}
    </div>
  );
}

function IntegrationCard({
  icon: Icon,
  name,
  description,
  connected,
  loading,
  onConnect,
  onDisconnect,
}: {
  icon: typeof Mail;
  name: string;
  description: string;
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex items-start gap-4">
      <div className="h-10 w-10 rounded-lg border border-border bg-surface-muted grid place-items-center shrink-0">
        <Icon className="h-4.5 w-4.5 text-foreground-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-foreground">{name}</h3>
          {connected ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </span>
          ) : (
            <span className="text-[11px] text-foreground-subtle">Not connected</span>
          )}
        </div>
        <p className="text-[12.5px] text-foreground-muted mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0">
        {loading ? (
          <PrimaryBtn disabled>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </PrimaryBtn>
        ) : connected ? (
          <GhostBtn onClick={onDisconnect}>Disconnect</GhostBtn>
        ) : (
          <PrimaryBtn onClick={onConnect}>
            <LinkIcon className="h-3.5 w-3.5" /> Connect
          </PrimaryBtn>
        )}
      </div>
    </div>
  );
}

function CRMCard({
  row,
  busy,
  onConnect,
  onDisconnect,
  onSync,
}: {
  row: CRMIntegrationRow;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  const meta = CRM_META[row.provider];
  const lastSynced = row.config?.last_synced_at ?? null;
  const err = row.config?.last_error ?? null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex items-start gap-4">
      <div className="h-10 w-10 rounded-lg border border-border bg-surface-muted grid place-items-center shrink-0">
        <Database className="h-4.5 w-4.5 text-foreground-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[14px] font-semibold text-foreground">{meta.name}</h3>
          <StatusBadge status={row.status} />
          {row.status === "connected" && (
            <span className="text-[11px] text-foreground-subtle">
              Last sync: {formatRelative(lastSynced)}
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-foreground-muted mt-1 leading-relaxed">
          {meta.description}
        </p>
        {err && row.status !== "connected" && (
          <p className="text-[11.5px] text-foreground-subtle mt-1.5 leading-relaxed">{err}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {row.status === "connected" ? (
          <>
            <GhostBtn onClick={onSync}>
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Sync
            </GhostBtn>
            <GhostBtn onClick={onDisconnect}>Disconnect</GhostBtn>
          </>
        ) : row.status === "pending" ? (
          <>
            <GhostBtn onClick={onDisconnect}>Cancel</GhostBtn>
            <PrimaryBtn onClick={onConnect} disabled={busy}>
              Retry
            </PrimaryBtn>
          </>
        ) : (
          <PrimaryBtn onClick={onConnect} disabled={busy}>
            <LinkIcon className="h-3.5 w-3.5" /> Connect
          </PrimaryBtn>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CRMIntegrationRow["status"] }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </span>
    );
  }
  if (status === "pending") {
    return <span className="text-[11px] text-foreground-subtle">Setup pending</span>;
  }
  if (status === "error") {
    return <span className="text-[11px] text-foreground-subtle">Error</span>;
  }
  return <span className="text-[11px] text-foreground-subtle">Not connected</span>;
}

function DataCard({
  icon: Icon,
  label,
  onImport,
  manualHref,
}: {
  icon: typeof Building2;
  label: string;
  onImport: () => void;
  manualHref: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg border border-border bg-surface-muted grid place-items-center shrink-0">
          <Icon className="h-4 w-4 text-foreground-muted" />
        </div>
        <h4 className="text-[13.5px] font-semibold text-foreground">{label}</h4>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <GhostBtn onClick={onImport}>
          <Upload className="h-3.5 w-3.5" /> Import CSV
        </GhostBtn>
        <Link
          to={manualHref}
          className="h-8 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs text-foreground-muted hover:text-foreground hover:border-border-strong transition"
        >
          <Plus className="h-3.5 w-3.5" /> Add manually
        </Link>
      </div>
    </div>
  );
}

// Silence unused import
export const _placeholder = EmptyState;
