"use client";
import { Github } from "@/components/icons/github";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  GitBranch,
  GitPullRequest,
  LayoutDashboard,
  Settings,
  Sparkles,
} from "lucide-react";
import { Logo } from "./logo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IS_MOCK_MODE } from "@/lib/api-client";
import { getConnectionStatus } from "@/lib/services/enrich";
import { useAsyncData } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: GitBranch },
  { href: "/pulls", label: "Pull Requests", icon: GitPullRequest },
  { href: "/reviews", label: "Reviews", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, collapsed, pathname, onNavigate }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-muted hover:text-foreground",
        collapsed ? "justify-center px-0" : "",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
        strokeWidth={2}
      />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {active && !collapsed ? (
        <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden="true" />
      ) : null}
    </Link>
  );

  if (!collapsed) return link;
  return <Tooltip>{link}</Tooltip>;
}

function SidebarContent({ collapsed, pathname, onNavigate, connection, loading }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
        <Logo collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4" aria-label="Main">
        {!collapsed ? (
          <p className="px-2.5 pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </p>
        ) : null}
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                collapsed={collapsed}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn("space-y-2 border-t border-sidebar-border p-2.5", collapsed ? "px-2" : "")}>
        {IS_MOCK_MODE ? (
          collapsed ? (
            <Tooltip>
              <Link
                href="/settings"
                aria-label="Demo data mode"
                className="flex h-9 items-center justify-center rounded-lg bg-sidebar-muted text-amber-600 dark:text-amber-400"
              >
                <Database className="size-4" />
              </Link>
            </Tooltip>
          ) : (
            <Badge
              variant="warning"
              className="w-full justify-start gap-2 rounded-lg px-2.5 py-1.5 font-normal"
              title="Mock data is enabled. Set NEXT_PUBLIC_USE_MOCK_DATA=false to use the live backend."
            >
              <Database className="size-3.5" />
              Demo data
            </Badge>
          )
        ) : null}

        <ConnectionStatus
          collapsed={collapsed}
          connection={connection}
          loading={loading}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

function ConnectionStatus({ collapsed, connection, loading, onNavigate }) {
  const connected = Boolean(connection?.connected);
  const count = connection?.count ?? 0;

  const label = loading
    ? "Checking GitHubâ€¦"
    : connected
      ? "GitHub connected"
      : "GitHub not connected";
  const detail = loading
    ? "Reading installation"
    : connected
      ? `${count} repositor${count === 1 ? "y" : "ies"}`
      : "Connect an installation";

  const dot = (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        loading ? "bg-muted-foreground/40" : connected ? "bg-success" : "bg-amber-500",
      )}
      aria-hidden="true"
    />
  );

  const body = collapsed ? (
    <Link
      href="/github"
      onClick={onNavigate}
      aria-label={label}
      className="flex h-9 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-muted text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="relative">
        <Github className="size-4" />
        <span
          className={cn(
            "absolute -right-1.5 -top-1 size-1.5 rounded-full",
            connected ? "bg-success" : "bg-amber-500",
          )}
        />
      </span>
    </Link>
  ) : (
    <Link
      href="/github"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-muted px-2.5 py-2 transition-colors hover:bg-accent"
    >
      <Github className="size-4 shrink-0 text-foreground/80" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
      </span>
      {loading ? <Skeleton className="size-2 rounded-full" /> : dot}
    </Link>
  );

  return collapsed ? <Tooltip>{body}</Tooltip> : body;
}

export function AppSidebar({ collapsed, mobileOpen, onMobileClose }) {
  const pathname = usePathname();
  const { data: connection, loading } = useAsyncData(getConnectionStatus, "sidebar-connection");

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar lg:flex",
          collapsed ? "w-[84px]" : "w-[268px]",
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          onNavigate={undefined}
          connection={connection}
          loading={loading}
        />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={(open) => (open ? null : onMobileClose())}>
        <DialogContent className="w-[280px] lg:hidden">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Browse PatchPilot pages and check the GitHub connection.
          </DialogDescription>
          <SidebarContent
            collapsed={false}
            pathname={pathname}
            onNavigate={onMobileClose}
            connection={connection}
            loading={loading}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}