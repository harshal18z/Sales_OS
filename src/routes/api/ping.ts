import { createFileRoute } from "@/lib/router-compat";

export const Route = createFileRoute("/api/ping")({
  server: {
    handlers: {
      GET: async () =>
        new Response("ok", {
          status: 200,
          headers: {
            "content-type": "text/plain",
            "cache-control": "no-store",
          },
        }),
      HEAD: async () =>
        new Response(null, {
          status: 200,
          headers: { "cache-control": "no-store" },
        }),
    },
  },
});
