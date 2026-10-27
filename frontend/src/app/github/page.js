"use client";
import { Github } from "@/components/icons/github";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { useAsyncData } from "@/lib/hooks";
import { getGitHubPageData } from "@/lib/services/enrich";
import { API_URL, IS_MOCK_MODE } from "@/lib/api-client";
import { safeArray, safeObject, formatRelativeTime } from "@/lib/utils";

const PERMISSIONS = [
  { key: "contents", label: "Contents", reason: "Read changed files for static analysis" },
  { key: "pullRequests", label: "Pull requests", reason: "Read diffs and post review summaries" },
  { key: "metadata", label: "Metadata", reason: "List repositories in the installation" },
];

export default function GitHubPage() {
  const { data, error, loading, refetch } = useAsyncData(getGitHubPageData, "github-page");
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);

  const result = safeObject(data);
  const repositories = safeArray(result.repositories);
  const installation = safeObject(result.installation);
  const connected = result.connected === true;

  const startInstall = () => {
    if (!result.installUrl) {
      toast({
        variant: "error",
        title: "GitHub installation is unavailable",
        description: "Start the API and configure the GitHub App before connecting.",
      });
      return;
    }

    setOpening(true);
    const popup = window.open(result.installUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      toast({
        variant: "info",
        title: "Opening GitHub in this tab",
        description: "Your browser blocked the new tab, so the installation page will open here.",
      });
      window.location.assign(result.installUrl);
    }
    window.setTimeout(() => setOpening(false), 1200);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integration"
        title="GitHub"
        description="PatchPilot reviews pull requests through a GitHub App installation. Nothing is written to your repositories without the App's permissions."
        actions={
          <Button variant="ghost" size="icon" onClick={refetch} aria-label="Refresh connection" title="Refresh connection">
            <RefreshCw className="size-4" />
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorState
          title="Could not check the GitHub connection"
          description={error.message}
          onRetry={refetch}
          retryLabel="Retry connection check"
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                  <Github className="size-6 text-foreground" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">GitHub App</h2>
                    {connected ? (
                      <Badge variant="success" className="gap-1 font-normal">
                        <Check className="size-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1 font-normal">
                        <TriangleAlert className="size-3" />
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                    {connected
                      ? `Installation active${installation.account ? ` for ${installation.account}` : ""}. PatchPilot can read pull requests and post review summaries for the repositories below.`
                      : "Install the PatchPilot GitHub App on the repositories you want reviewed. No personal access token is stored in the browser."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {installation.account ? <span>Account: {installation.account}</span> : null}
                    {installation.installationId ? (
                      <span className="font-mono">Installation {installation.installationId}</span>
                    ) : null}
                    <span>
                      {repositories.length} repositor{repositories.length === 1 ? "y" : "ies"} accessible
                    </span>
                    {installation.installedAt ? (
                      <span>Installed {formatRelativeTime(installation.installedAt)}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <Button onClick={startInstall} disabled={opening}>
                  {opening ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
                  {connected ? "Manage installation" : "Install GitHub App"}
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/repositories">
                    Browse repositories
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
              {PERMISSIONS.map((permission) => (
                <div key={permission.key} className="bg-card p-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <ShieldCheck className="size-3.5 text-success" />
                    {permission.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{permission.reason}</p>
                  <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                    {installation.permissions?.[permission.key] ??
                      (permission.key === "pullRequests" ? "read-write" : "read")}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Connected repositories</CardTitle>
                  <CardDescription>Repositories this installation can access.</CardDescription>
                </div>
                <Badge variant="neutral" className="font-normal">{repositories.length}</Badge>
              </CardHeader>
              <CardContent>
                {repositories.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Github}
                    title={connected ? "No repositories in this installation" : "No connection yet"}
                    description={
                      connected
                        ? "Grant the App access to repositories in GitHub, then refresh."
                        : "Install the PatchPilot GitHub App to connect repositories."
                    }
                    action={
                      <Button size="sm" onClick={startInstall}>
                        {connected ? "Manage access" : "Install GitHub App"}
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {repositories.map((repository) => (
                      <li
                        key={repository.id ?? repository.fullName}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/repositories/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`}
                            className="block truncate text-sm font-medium text-foreground hover:text-primary"
                          >
                            {repository.owner}/{repository.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {repository.private ? "Private" : "Public"} Â· {repository.defaultBranch ?? "main"}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/repositories/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`}>
                            Open
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection details</CardTitle>
                <CardDescription>Read-only information about this workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Backend" value={API_URL} mono />
                <DetailRow label="Mode" value={IS_MOCK_MODE ? "Demo data" : "Live backend"} />
                <DetailRow label="Status" value={connected ? "Connected" : "Not connected"} />
                <DetailRow
                  label="Access"
                  value={connected ? `${repositories.length} repositories` : "None"}
                />
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  <KeyRound className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Private keys, installation tokens and webhook secrets stay on the backend. This
                    page never receives or stores them.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Setup checklist</CardTitle>
              <CardDescription>What the backend needs before real reviews can run.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <ChecklistRow done={connected} label="GitHub App installed on at least one repository" />
                <ChecklistRow
                  done={connected}
                  label="Pull request read/write permission granted"
                />
                <ChecklistRow done={connected} label="Webhook deliveries reach /api/webhooks/github" />
                <ChecklistRow
                  done={!IS_MOCK_MODE}
                  label="Frontend connected to the live backend (NEXT_PUBLIC_USE_MOCK_DATA=false)"
                />
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2.5 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-xs font-medium text-foreground ${mono ? "break-all font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ChecklistRow({ done, label }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-success-soft text-success" : "border border-border bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="size-3" /> : <span className="size-1 rounded-full bg-current" />}
      </span>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}