import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const absMs = Math.abs(diffMs);
  const units = [
    { limit: 60 * 1000, divisor: 1000, unit: "second" },
    { limit: 60 * 60 * 1000, divisor: 60 * 1000, unit: "minute" },
    { limit: 24 * 60 * 60 * 1000, divisor: 60 * 60 * 1000, unit: "hour" },
    { limit: 7 * 24 * 60 * 60 * 1000, divisor: 24 * 60 * 60 * 1000, unit: "day" },
    { limit: 30 * 24 * 60 * 60 * 1000, divisor: 7 * 24 * 60 * 60 * 1000, unit: "week" },
    { limit: 365 * 24 * 60 * 60 * 1000, divisor: 30 * 24 * 60 * 60 * 1000, unit: "month" },
  ];

  for (const { limit, divisor, unit } of units) {
    if (absMs < limit) {
      const amount = Math.max(1, Math.round(diffMs / divisor));
      const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
      return formatter.format(-amount, unit);
    }
  }

  return formatDate(date);
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(startValue, endValue) {
  if (!startValue || !endValue) return null;
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;

  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) return restSeconds ? `${minutes}m ${restSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("en").format(value);
}

export function shortSha(value) {
  if (!value) return "—";
  return String(value).slice(0, 7);
}

export function titleCase(value) {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function sentenceCase(value) {
  if (!value) return "";
  const text = String(value).toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function truncate(value, length = 120) {
  if (!value) return "";
  const text = String(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function isValidId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function firstParam(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function formatLocation(filePath, line) {
  if (!filePath) return "Repository-wide";
  return line ? `${filePath}:${line}` : filePath;
}

export function severityWeight(severity) {
  return { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 }[severity] ?? 0;
}

export function sortBySeverity(findings) {
  return [...findings].sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
  );
}
