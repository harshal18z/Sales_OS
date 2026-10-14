import { createFileRoute, Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SalesOS AI" },
      { name: "description", content: "How SalesOS AI collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Policy — SalesOS AI" },
      { property: "og:description", content: "How SalesOS AI collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalShell title="Privacy Policy" subtitle="Last updated: placeholder date" />;
}

export function LegalShell({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-16 px-6 flex items-center border-b border-border">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] text-foreground-muted hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
      </header>
      <main className="max-w-[720px] mx-auto px-6 py-16">
        <h1 className="text-heading">{title}</h1>
        <p className="text-caption mt-2">{subtitle}</p>
        <div className="prose prose-sm mt-8 space-y-4 text-body text-foreground-muted">
          <p>
            This is placeholder legal content. Final copy will be provided by the SalesOS AI team.
            Nothing on this page constitutes a binding agreement until replaced with the approved
            version.
          </p>
          <p>
            Sections to be added include: data we collect, how we use it, sharing and subprocessors,
            retention, your rights, and how to contact us.
          </p>
        </div>
      </main>
    </div>
  );
}
