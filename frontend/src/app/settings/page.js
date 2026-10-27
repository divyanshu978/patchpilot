"use client";
import { Github } from "@/components/icons/github";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  CircleAlert,
  Info,
  Monitor,
  Moon,
  RotateCcw,
  Server,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common/page-header";
import { FilterSelect } from "@/components/common/filter-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/providers/toast-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useAsyncData } from "@/lib/hooks";
import { getConnectionStatus } from "@/lib/services/enrich";
import { API_URL, IS_MOCK_MODE } from "@/lib/api-client";
import { DEFAULT_PREFERENCES, PREFERENCES_STORAGE_KEY, SEVERITIES } from "@/lib/constants";
import { safeObject } from "@/lib/utils";

const CATEGORY_TOGGLES = [
  {
    key: "bugDetection",
    title: "Bug detection",
    description: "Flag logic errors, unsafe assumptions and broken edge cases.",
  },
  {
    key: "securityAnalysis",
    title: "Security analysis",
    description: "Detect leaked secrets, injection risks and unsafe patterns.",
  },
  {
    key: "performanceAnalysis",
    title: "Performance analysis",
    description: "Point out N+1 queries, repeated work and expensive renders.",
  },
  {
    key: "testSuggestions",
    title: "Test coverage suggestions",
    description: "Note when changed code has no accompanying tests.",
  },
];

const SEVERITY_OPTIONS = [
  { value: "CRITICAL", label: "Critical only" },
  { value: "HIGH", label: "High and above" },
  { value: "MEDIUM", label: "Medium and above" },
  { value: "LOW", label: "Low and above" },
  { value: "INFO", label: "Everything" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { data: connection, loading } = useAsyncData(getConnectionStatus, "settings-connection");

  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "null");
    } catch {
      stored = null;
    }

    // Preferences live in localStorage and can only be restored after hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    setPreferences(stored ? { ...DEFAULT_PREFERENCES, ...safeObject(stored) } : DEFAULT_PREFERENCES);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const persist = (next) => {
    setPreferences(next);
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      toast({
        variant: "error",
        title: "Could not save preferences",
        description: "Browser storage is unavailable in this context.",
      });
    }
  };

  const toggleCategory = (key, value) => {
    persist({ ...preferences, [key]: value });
  };

  const resetPreferences = () => {
    persist(DEFAULT_PREFERENCES);
    setTheme("light");
    toast({ variant: "success", title: "Preferences reset to defaults" });
  };

  const connected = connection?.connected === true;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Local review preferences for this browser, plus the current GitHub and API connection status."
        actions={
          <Button variant="secondary" onClick={resetPreferences}>
            <RotateCcw className="size-4" />
            Reset preferences
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>GitHub integration</CardTitle>
            <CardDescription>Connection status for the PatchPilot GitHub App.</CardDescription>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : connected ? (
            <Badge variant="success" className="gap-1 font-normal">
              <Check className="size-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1 font-normal">
              <CircleAlert className="size-3" />
              Not connected
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Github className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {connected
                  ? `Installation active${connection?.account ? ` for ${connection.account}` : ""}`
                  : "No GitHub installation detected"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {connected
                  ? `${connection?.count ?? 0} repositories are available for review.`
                  : "Install the GitHub App to start reviewing pull requests."}
              </p>
            </div>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/github">{connected ? "Manage connection" : "Connect GitHub"}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review preferences</CardTitle>
          <CardDescription>
            Stored in this browser only. These are not sent to the backend yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {CATEGORY_TOGGLES.map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-start justify-between gap-4 border-b border-border py-3.5 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <label
                  htmlFor={`toggle-${toggle.key}`}
                  className="cursor-pointer text-sm font-medium text-foreground"
                >
                  {toggle.title}
                </label>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{toggle.description}</p>
              </div>
              <Switch
                id={`toggle-${toggle.key}`}
                checked={Boolean(preferences[toggle.key])}
                onCheckedChange={(value) => toggleCategory(toggle.key, value)}
                aria-label={toggle.title}
                disabled={!hydrated}
              />
            </div>
          ))}

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label htmlFor="min-severity" className="text-sm font-medium text-foreground">
                Minimum severity to highlight
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lower-severity findings stay visible but are de-emphasized.
              </p>
            </div>
            <FilterSelect
              id="min-severity"
              label="Minimum severity"
              value={preferences.minSeverity}
              onChange={(value) => persist({ ...preferences, minSeverity: value })}
              options={SEVERITY_OPTIONS.filter((option) => SEVERITIES.includes(option.value))}
              className="sm:w-48"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Theme preference is saved on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setTheme(option.value);
                      persist({ ...preferences, theme: option.value });
                    }}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API connection</CardTitle>
            <CardDescription>Where this dashboard sends requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2.5">
              <span className="text-xs text-muted-foreground">Base URL</span>
              <span className="break-all text-right font-mono text-xs text-foreground">{API_URL}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2.5">
              <span className="text-xs text-muted-foreground">Data source</span>
              <Badge variant={IS_MOCK_MODE ? "warning" : "success"} className="gap-1 font-normal">
                <Server className="size-3" />
                {IS_MOCK_MODE ? "Demo data" : "Live backend"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Health</span>
              <Badge variant={loading ? "neutral" : connected ? "success" : "warning"} className="font-normal">
                {loading ? "Checkingâ€¦" : connected ? "Reachable" : "No installation"}
              </Badge>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Set <code className="font-mono">NEXT_PUBLIC_API_URL</code> and{" "}
                <code className="font-mono">NEXT_PUBLIC_USE_MOCK_DATA=false</code> to use the live
                PatchPilot backend. Review preferences stay local in both modes.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}