import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_workspace",
  title: "Create workspace",
  description: "Create a new SalesOS workspace owned by the signed-in user.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Human-readable workspace name."),
    industry: z.string().trim().optional().describe("Industry, e.g. SaaS, Fintech."),
    goal: z.string().trim().optional().describe("Primary sales goal for this workspace."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async ({ name, industry, goal }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const baseSlug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "ws";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: ws, error } = await supabase
      .from("workspaces")
      .insert({ owner_id: userId, name, slug, industry: industry ?? null, goal: goal ?? null })
      .select("id, name, slug")
      .single();
    if (error || !ws) {
      return {
        content: [{ type: "text", text: error?.message ?? "Failed to create" }],
        isError: true,
      };
    }
    const { error: mErr } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
    if (mErr) return { content: [{ type: "text", text: mErr.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created workspace ${ws.name} (${ws.slug}).` }],
      structuredContent: { workspace: ws },
    };
  },
});
