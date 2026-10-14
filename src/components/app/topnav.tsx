import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

import { Link, useNavigate } from "@/lib/router-compat";
import {
  Search,
  Bell,
  ChevronsUpDown,
  Check,
  Moon,
  Sun,
  Command as CommandIcon,
  Plus,
  LogOut,
  User,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const workspaces = [
  { id: "acme", name: "Acme Sales", plan: "Growth" },
  { id: "north", name: "Northwind Co.", plan: "Starter" },
  { id: "vertex", name: "Vertex Labs", plan: "Enterprise" },
];

const notifications = [
  { title: "Meeting confirmed with Ramp", meta: "2 min ago", unread: true },
  { title: "New reply from Sarah at Notion", meta: "18 min ago", unread: true },
  { title: "Campaign 'Q3 Outbound' finished", meta: "1 h ago", unread: false },
];

const navRoutes: { label: string; to: string; group: string }[] = [
  { label: "Dashboard", to: "/dashboard", group: "Navigate" },
  { label: "Campaigns", to: "/campaigns", group: "Navigate" },
  { label: "Research", to: "/research", group: "Navigate" },
  { label: "Companies", to: "/companies", group: "Navigate" },
  { label: "Leads", to: "/leads", group: "Navigate" },
  { label: "Emails", to: "/emails", group: "Navigate" },
  { label: "Templates", to: "/templates", group: "Navigate" },
  { label: "Follow-ups", to: "/followups", group: "Navigate" },
  { label: "Calendar", to: "/calendar", group: "Navigate" },
  { label: "Meetings", to: "/meetings", group: "Navigate" },
  { label: "CRM", to: "/crm", group: "Navigate" },
  { label: "Analytics", to: "/analytics", group: "Navigate" },
  { label: "Integrations", to: "/integrations", group: "Navigate" },
  { label: "Team", to: "/team", group: "Navigate" },
  { label: "Settings", to: "/settings", group: "Navigate" },
  { label: "Billing", to: "/billing", group: "Navigate" },
  { label: "Profile", to: "/profile", group: "Navigate" },
];

export function AppTopNav() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");

  const [workspace, setWorkspace] = useState(workspaces[0]);
  const [dark, setDark] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName =
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split("@")[0] ||
    "User";
  const email = user?.email ?? "";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const unread = notifications.filter((n) => n.unread).length;


  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="h-full px-4 flex items-center gap-3">
        {/* Workspace switcher */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 h-9 px-2.5 rounded-md hover:bg-surface-muted transition-colors">
              <div className="h-6 w-6 rounded bg-foreground text-background grid place-items-center text-[11px] font-semibold">
                {workspace.name.charAt(0)}
              </div>
              <span className="text-[13.5px] font-medium max-w-[140px] truncate">
                {workspace.name}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-foreground-muted" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1">
            <div className="px-2 py-1.5 text-caption">Workspaces</div>
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => setWorkspace(w)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-muted text-left"
              >
                <div className="h-6 w-6 rounded bg-foreground text-background grid place-items-center text-[11px] font-semibold">
                  {w.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate">{w.name}</div>
                  <div className="text-[11.5px] text-foreground-muted">{w.plan}</div>
                </div>
                {workspace.id === w.id && (
                  <Check className="h-4 w-4 text-foreground" />
                )}
              </button>
            ))}
            <div className="hairline my-1" />
            <Link
              to="/workspace-new"
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-muted text-[13.5px]"
            >
              <Plus className="h-4 w-4" />
              Create workspace
            </Link>
          </PopoverContent>
        </Popover>

        {/* Search */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center gap-2 h-9 flex-1 max-w-md px-3 rounded-md border border-border bg-background hover:border-border-strong transition-colors text-left"
        >
          <Search className="h-4 w-4 text-foreground-muted" />
          <span className="text-[13.5px] text-foreground-muted flex-1">
            Search or ask AI…
          </span>
          <span className="hidden sm:flex items-center gap-1">
            <kbd className="kbd">
              <CommandIcon className="h-3 w-3" />
            </kbd>
            <kbd className="kbd">K</kbd>
          </span>
        </button>

        {/* Ask AI (Command Center) */}
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("salesos:ask-ai"))
          }
          className="h-9 hidden md:inline-flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-background hover:border-border-strong text-[13px]"
          aria-label="Open AI Command Center"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Ask AI</span>
          <kbd className="kbd ml-1">
            <CommandIcon className="h-3 w-3" />
          </kbd>
          <kbd className="kbd">J</kbd>
        </button>

        <div className="flex-1 md:hidden" />


        {/* Right cluster */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDark((d) => !d)}
            className="h-9 w-9 grid place-items-center rounded-md hover:bg-surface-muted text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                className="relative h-9 w-9 grid place-items-center rounded-md hover:bg-surface-muted text-foreground-muted hover:text-foreground transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-[13.5px] font-semibold">Notifications</span>
                <span className="text-caption">{unread} new</span>
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {notifications.map((n, i) => (
                  <li
                    key={i}
                    className="px-3 py-2.5 border-b border-border last:border-0 hover:bg-surface-muted"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                          n.unread ? "bg-accent" : "bg-transparent",
                        )}
                      />
                      <div className="min-w-0">
                        <div className="text-[13.5px] text-foreground truncate">
                          {n.title}
                        </div>
                        <div className="text-caption">{n.meta}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 grid place-items-center rounded-full bg-surface-muted text-[12px] font-semibold hover:ring-2 hover:ring-border transition">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-[13.5px] font-semibold">{displayName}</div>
                <div className="text-caption">{email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                <User className="h-4 w-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <SettingsIcon className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/billing" })}>
                <CreditCardMini /> Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput
          placeholder="Search or ask AI to do something…"
          value={cmdQuery}
          onValueChange={setCmdQuery}
          onKeyDown={(e) => {
            if (e.key === "Enter" && cmdQuery.trim()) {
              const q = cmdQuery.trim();
              // If it doesn't look like a nav match, treat as an AI question.
              const isNav = navRoutes.some((r) =>
                r.label.toLowerCase().includes(q.toLowerCase()),
              );
              if (!isNav) {
                e.preventDefault();
                setCmdOpen(false);
                setCmdQuery("");
                window.dispatchEvent(
                  new CustomEvent("salesos:ask-ai", { detail: { query: q } }),
                );
              }
            }
          }}
        />
        <CommandList>
          <CommandEmpty>
            <button
              className="text-[13px] text-foreground"
              onClick={() => {
                const q = cmdQuery.trim();
                setCmdOpen(false);
                setCmdQuery("");
                window.dispatchEvent(
                  new CustomEvent("salesos:ask-ai", {
                    detail: { query: q || undefined },
                  }),
                );
              }}
            >
              Ask AI Command Center{cmdQuery ? `: "${cmdQuery}"` : ""}
            </button>
          </CommandEmpty>
          <CommandGroup heading="Ask AI">
            {[
              "Which deals are at risk?",
              "Who should I contact today?",
              "Show hottest leads.",
              "Forecast this month's revenue.",
              "Which customers haven't replied?",
              "Which campaigns performed best?",
            ].map((ex) => (
              <CommandItem
                key={ex}
                onSelect={() => {
                  setCmdOpen(false);
                  setCmdQuery("");
                  window.dispatchEvent(
                    new CustomEvent("salesos:ask-ai", { detail: { query: ex } }),
                  );
                }}
              >
                <Sparkles className="h-3.5 w-3.5 mr-2 text-foreground-muted" />
                {ex}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigate">
            {navRoutes.map((r) => (
              <CommandItem
                key={r.to}
                onSelect={() => {
                  setCmdOpen(false);
                  setCmdQuery("");
                  navigate({ to: r.to });
                }}
              >
                {r.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

    </header>
  );
}

function CreditCardMini() {
  return (
    <svg
      className="h-4 w-4 mr-2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
