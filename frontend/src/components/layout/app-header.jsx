"use client";
import { Github } from "@/components/icons/github";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleAlert,
  Database,
  GitPullRequest,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldAlert,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { IS_MOCK_MODE } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS = {
  repositories: "Repositories",
  pulls: "Pull Requests",
  reviews: "Reviews",
  github: "GitHub",
  settings: "Settings",
};

function buildBreadcrumbs(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Overview", href: "/" }];

  const crumbs = [{ label: "Overview", href: "/" }];
  let path = "";

  segments.forEach((segment, index) => {
    path += `/${segment}`;
    let label = SEGMENT_LABELS[segment] ?? decodeURIComponent(segment);
    if (segments[0] === "reviews" && index === 1) {
      label = label.length > 12 ? `Review ${label.slice(0, 8)}` : `Review ${label}`;
    }
    crumbs.push({ label, href: path });
  });

  return crumbs;
}

export function AppHeader({ collapsed, onToggleCollapsed, onOpenMobile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const breadcrumbs = buildBreadcrumbs(pathname);
  const current = breadcrumbs[breadcrumbs.length - 1];

  const submitSearch = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/reviews?q=${encodeURIComponent(trimmed)}` : "/reviews");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onOpenMobile}
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;
                return (
                  <li key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1">
                    {index > 0 ? (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                    ) : null}
                    {last ? (
                      <span className="truncate font-medium text-foreground" aria-current="page">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="truncate text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          {IS_MOCK_MODE ? (
            <Badge
              variant="warning"
              className="gap-1 px-2 py-0.5 text-[11px] font-normal"
              title="Demo data is enabled. Set NEXT_PUBLIC_USE_MOCK_DATA=false to use the live backend."
            >
              <Database className="size-3" />
              Demo data
            </Badge>
          ) : null}
        </div>

        <span className="truncate text-sm font-medium md:hidden">{current.label}</span>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <form onSubmit={submitSearch} className="hidden sm:block" role="search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search reviewsâ€¦"
                aria-label="Search reviews and pull requests"
                className="h-8 w-44 pl-8 text-[13px] lg:w-64"
              />
            </div>
          </form>

          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            onClick={() => router.push("/reviews")}
            aria-label="Search reviews"
          >
            <Search className="size-4" />
          </Button>

          <NotificationsMenu />

          <ThemeToggle />

          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Review alerts" className="relative">
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Review alerts</DropdownMenuLabel>
        <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-border" />
        <DropdownMenuItem asChild>
          <Link href="/reviews?severity=CRITICAL" className="cursor-pointer">
            <ShieldAlert className="size-4 text-red-500" />
            <span>Critical findings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/reviews?status=FAILED" className="cursor-pointer">
            <CircleAlert className="size-4 text-amber-500" />
            <span>Reviews that need attention</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pulls" className="cursor-pointer">
            <GitPullRequest className="size-4" />
            <span>Pull requests to review</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open profile menu"
          className={cn(
            "flex size-8 items-center justify-center rounded-full border border-border bg-card text-[11px] font-semibold text-foreground shadow-[0_1px_2px_rgba(16,12,40,0.06)] transition-colors hover:bg-accent",
          )}
        >
          PP
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block text-sm font-medium text-foreground">PatchPilot workspace</span>
          <span className="block text-[11px] font-normal text-muted-foreground">
            {IS_MOCK_MODE ? "Demo data mode" : "Live backend mode"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-border" />
        <DropdownMenuItem asChild>
          <Link href="/github" className="cursor-pointer">
            <Github className="size-4" />
            <span>GitHub connection</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="size-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-border" />
        <DropdownMenuItem disabled>
          <User className="size-4" />
          <span>Authentication is not enabled</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}