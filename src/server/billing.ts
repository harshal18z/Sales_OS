import { createServerRequestContext } from "@/server/server-fn.runtime";

type MockPlan = "free" | "pro" | "business";

export async function simulatePlanChange(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const context = await createServerRequestContext(authorization.slice(7));
  const input = await request.json().catch(() => null) as { workspaceId?: unknown; plan?: unknown } | null;
  if (!input || typeof input.workspaceId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.workspaceId)) {
    return Response.json({ error: "A valid workspace is required." }, { status: 400 });
  }
  if (input.plan !== "free" && input.plan !== "pro" && input.plan !== "business") {
    return Response.json({ error: "Choose a supported demo plan." }, { status: 400 });
  }

  const { data: roles, error: roleError } = await context.supabase
    .from("user_roles").select("role").eq("workspace_id", input.workspaceId).eq("user_id", context.userId);
  if (roleError) throw roleError;
  if (!(roles ?? []).some((row) => row.role === "owner" || row.role === "admin")) {
    return Response.json({ error: "Only workspace owners and admins can manage the demo plan." }, { status: 403 });
  }

  const { data, error } = await context.supabase.from("workspaces")
    .update({ plan: input.plan as MockPlan }).eq("id", input.workspaceId).select("id,plan").maybeSingle();
  if (error) throw error;
  if (!data) return Response.json({ error: "Workspace not found or plan could not be changed." }, { status: 404 });
  return Response.json({ plan: data.plan, simulated: true, charged: false });
}
