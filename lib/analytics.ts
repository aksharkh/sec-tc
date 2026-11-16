import { format, startOfDay, startOfWeek } from "date-fns";
import type { LogEvent, Reviewer } from "@/lib/types";
import { AGENCIES } from "@/lib/mock/catalog";
import { DAY } from "@/lib/utils";

export const isView = (e: LogEvent) => e.action === "view";
export const isDownload = (e: LogEvent) => e.action === "download" || e.action === "download_all";

export function inWindow(logs: LogEvent[], fromDaysAgo: number, toDaysAgo = 0) {
  const now = Date.now();
  const from = now - fromDaysAgo * DAY;
  const to = now - toDaysAgo * DAY;
  return logs.filter((e) => {
    const t = new Date(e.at).getTime();
    return t >= from && t < to;
  });
}

export function pctChange(cur: number, prev: number) {
  if (!prev) return cur ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

export type Bucket = { key: string; label: string; web: number; api: number; total: number };

/** Activity per day (30 days) or per week (90 days, 6 months), split by channel. */
export function activitySeries(logs: LogEvent[], range: "30d" | "90d" | "6m"): Bucket[] {
  const now = new Date();
  const weekly = range !== "30d";
  const days = range === "30d" ? 30 : range === "90d" ? 91 : 182;
  const buckets = new Map<string, Bucket>();
  if (weekly) {
    const weeks = Math.ceil(days / 7);
    for (let i = weeks - 1; i >= 0; i--) {
      const d = startOfWeek(new Date(now.getTime() - i * 7 * DAY), { weekStartsOn: 1 });
      const key = format(d, "yyyy-MM-dd");
      buckets.set(key, { key, label: format(d, "MMM d"), web: 0, api: 0, total: 0 });
    }
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d = startOfDay(new Date(now.getTime() - i * DAY));
      const key = format(d, "yyyy-MM-dd");
      buckets.set(key, { key, label: format(d, "MMM d"), web: 0, api: 0, total: 0 });
    }
  }
  const cutoff = now.getTime() - days * DAY;
  for (const e of logs) {
    const t = new Date(e.at);
    if (t.getTime() < cutoff || e.action === "sign_in") continue;
    const key = format(weekly ? startOfWeek(t, { weekStartsOn: 1 }) : startOfDay(t), "yyyy-MM-dd");
    const b = buckets.get(key);
    if (!b) continue;
    if (e.channel === "api") b.api++;
    else b.web++;
    b.total++;
  }
  return [...buckets.values()];
}

/** 12 weekly counts for sparklines. */
export function weeklyCounts(logs: LogEvent[], pred: (e: LogEvent) => boolean, weeks = 12) {
  const now = Date.now();
  const out = Array.from({ length: weeks }, () => 0);
  for (const e of logs) {
    if (!pred(e)) continue;
    const w = Math.floor((now - new Date(e.at).getTime()) / (7 * DAY));
    if (w >= 0 && w < weeks) out[weeks - 1 - w]! += 1;
  }
  return out;
}

export function activeReviewerTrend(reviewers: Reviewer[], weeks = 12) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const t = now - (weeks - 1 - i) * 7 * DAY;
    return reviewers.filter((r) => {
      const g = new Date(r.grantedAt).getTime();
      const end = r.status === "revoked" ? now - 34 * DAY : r.expiresAt ? new Date(r.expiresAt).getTime() : Infinity;
      return g <= t && t <= end;
    }).length;
  });
}

/** Top agencies × weekday activity matrix for the 3D landscape. */
export function agencyWeekdayMatrix(logs: LogEvent[], days: number, top = 6) {
  const now = Date.now();
  const from = now - days * DAY;
  const counts = new Map<string, number[]>();
  for (const e of logs) {
    const t = new Date(e.at).getTime();
    if (t < from || e.handle === "anonymous") continue;
    const row = counts.get(e.agencyId) ?? Array.from({ length: 7 }, () => 0);
    row[(new Date(e.at).getDay() + 6) % 7]! += 1;
    counts.set(e.agencyId, row);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).slice(0, top);
  return {
    rows: ranked.map(([id]) => AGENCIES.find((a) => a.id === id)?.short ?? id),
    cols: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    values: ranked.map(([, row]) => row),
  };
}
