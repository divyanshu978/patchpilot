"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeArray } from "@/lib/utils";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-[0_8px_30px_rgba(16,12,40,0.12)]">
      <p className="mb-1 font-medium text-foreground">{payload[0]?.payload?.fullDate ?? label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          {entry.dataKey === "reviews" ? "Reviews" : "Findings"}
          <span className="ml-auto font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ReviewActivityChart({ data }) {
  const points = safeArray(data);
  const hasActivity = points.some((point) => (point.reviews ?? 0) > 0 || (point.findings ?? 0) > 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Review activity</CardTitle>
          <CardDescription>Reviews and findings over the last 7 days.</CardDescription>
        </div>
      </CardHeader>
      <div className="h-[220px] px-2 pb-4">
        {hasActivity ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="reviewsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="findingsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                dy={6}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area
                type="monotone"
                dataKey="reviews"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#reviewsFill)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="findings"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#findingsFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No review activity yet.
          </div>
        )}
      </div>
    </Card>
  );
}