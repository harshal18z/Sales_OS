import { createFileRoute } from "@/lib/router-compat";
import { LegalShell } from "./privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SalesOS AI" },
      { name: "description", content: "The terms that govern your use of SalesOS AI." },
      { property: "og:title", content: "Terms of Service — SalesOS AI" },
      { property: "og:description", content: "The terms that govern your use of SalesOS AI." },
    ],
  }),
  component: () => <LegalShell title="Terms of Service" subtitle="Last updated: placeholder date" />,
});
