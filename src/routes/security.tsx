import { createFileRoute } from "@/lib/router-compat";
import { LegalShell } from "./privacy";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — SalesOS AI" },
      { name: "description", content: "How SalesOS AI keeps your workspace and data secure." },
      { property: "og:title", content: "Security — SalesOS AI" },
      { property: "og:description", content: "How SalesOS AI keeps your workspace and data secure." },
    ],
  }),
  component: () => <LegalShell title="Security" subtitle="Placeholder — final copy pending" />,
});
