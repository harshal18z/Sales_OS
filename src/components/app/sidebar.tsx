import { Link, useRouterState } from "@/lib/router-compat";
import {
  LayoutDashboard,
  Megaphone,
  Sparkles,
  Building2,
  Users,
  Mail,
  Calendar,
  Database,
  BarChart3,
  UserCog,
  Plug,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Bot,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

type Item = { label: string; to: string; icon: ComponentType<{ className?: string }> };

const items: Item[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Sales Copilot", to: "/copilot", icon: Bot },
  { label: "Campaigns", to: "/campaigns", icon: Megaphone },
  { label: "Research", to: "/research", icon: Sparkles },
  { label: "Companies", to: "/companies", icon: Building2 },
  { label: "Leads", to: "/leads", icon: Users },
  { label: "Emails", to: "/emails", icon: Mail },
  { label: "Meetings", to: "/meetings", icon: Calendar },
  { label: "CRM", to: "/crm", icon: Database },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Team", to: "/team", icon: UserCog },
  { label: "Integrations", to: "/integrations", icon: Plug },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Billing", to: "/billing", icon: CreditCard },
];

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 border-r border-border bg-surface transition-[width] duration-200 ease-out",
        collapsed ? "w-[64px]" : "w-[232px]",
      )}
    >
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
        <div className="h-7 w-7 rounded-md bg-foreground text-background grid place-items-center text-[13px] font-semibold shrink-0">
          S
        </div>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight truncate">
            SalesOS <span className="text-foreground-muted">AI</span>
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[13.5px] transition-colors",
                    active
                      ? "bg-surface-muted text-foreground font-medium"
                      : "text-foreground-muted hover:text-foreground hover:bg-surface-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        onClick={onToggle}
        className="h-10 border-t border-border flex items-center justify-center gap-2 text-[12.5px] text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
