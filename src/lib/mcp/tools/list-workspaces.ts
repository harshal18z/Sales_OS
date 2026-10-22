import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_workspaces",
  title: "List workspaces",
  description: "List the SalesOS workspaces the signed-in user belongs to.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: memberships, error: mErr } = await supabase
      .from("workspace_members")
      .select("workspace_id, role");
    if (mErr) return { content: [{ type: "text", text: mErr.message }], isError: true };
    const ids = (memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id);
    if (ids.length === 0) {
      return {
        content: [{ type: "text", text: "No workspaces yet." }],
        structuredContent: { workspaces: [] },
      };
    }
    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("id, name, slug, industry, team_size, goal, plan, created_at")
      .in("id", ids);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(workspaces, null, 2) }],
      structuredContent: { workspaces: workspaces ?? [] },
    };
  },
});
