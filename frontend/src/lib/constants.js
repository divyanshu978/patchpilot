export const REVIEW_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"];

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export const CATEGORIES = [
  "SECURITY",
  "BUG",
  "PERFORMANCE",
  "TEST",
  "MAINTAINABILITY",
  "STYLE",
  "DEPENDENCY",
];

export const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: "LayoutDashboard" },
  { href: "/repositories", label: "Repositories", icon: "GitBranch" },
  { href: "/pulls", label: "Pull Requests", icon: "GitPullRequest" },
  { href: "/reviews", label: "Reviews", icon: "Sparkles" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

export const PREFERENCES_STORAGE_KEY = "patchpilot-preferences";

export const DEFAULT_PREFERENCES = {
  bugDetection: true,
  securityAnalysis: true,
  performanceAnalysis: true,
  testSuggestions: true,
  minSeverity: "MEDIUM",
  theme: "system",
};
