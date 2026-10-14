import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWorkspacesTool from "./tools/list-workspaces";
import getProfileTool from "./tools/get-profile";
import createWorkspaceTool from "./tools/create-workspace";

// Direct Supabase issuer — the .lovable.cloud proxy fails RFC 8414 issuer match.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "salesos-mcp",
  title: "SalesOS AI",
  version: "0.1.0",
  instructions:
    "Tools for SalesOS AI. Read the signed-in user's profile, list their workspaces, and create new workspaces on their behalf.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listWorkspacesTool, getProfileTool, createWorkspaceTool],
});
