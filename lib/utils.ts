import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic PRNG so seeded demo data is stable between reloads. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Current time, read through a helper so render code stays lint-pure. */
export function nowMs() {
  return Date.now();
}

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const MIN = 60_000;

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const fmt = {
  date: (iso: string) => format(new Date(iso), "MMM d, yyyy"),
  short: (iso: string) => format(new Date(iso), "MMM d"),
  dateTime: (iso: string) => format(new Date(iso), "MMM d, yyyy, h:mm a"),
  time: (iso: string) => format(new Date(iso), "h:mm a"),
  iso: (iso: string) => format(new Date(iso), "yyyy-MM-dd"),
  ago: (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000 && diff > -60_000) return "just now";
    return formatDistanceToNowStrict(d, { addSuffix: true });
  },
  day: (iso: string) => {
    const d = new Date(iso);
    if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
    if (isYesterday(d)) return `Yesterday, ${format(d, "h:mm a")}`;
    return format(d, "MMM d, h:mm a");
  },
  num: (n: number) => n.toLocaleString("en-US"),
  compact: (n: number) =>
    n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K` : n.toLocaleString("en-US"),
  size: (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`),
  pct: (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)}%`,
};

export function initials(name: string) {
  return name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function emailDomain(email: string) {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

/** Domain allowlist match: "ofsa.gov" matches exactly and subdomains; "*.gov" matches any .gov address. */
export function domainMatches(pattern: string, domain: string) {
  const p = pattern.trim().toLowerCase();
  const d = domain.trim().toLowerCase();
  if (!p || !d) return false;
  if (p.startsWith("*.")) return d.endsWith(p.slice(1));
  return d === p || d.endsWith(`.${p}`);
}

/** Tiny line diff (LCS) used for the JSON snapshot comparison. */
export type DiffLine = { kind: "same" | "add" | "del"; text: string; a?: number; b?: number };
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]!, a: i + 1, b: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i]!, a: i + 1 });
      i++;
    } else {
      out.push({ kind: "add", text: b[j]!, b: j + 1 });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", text: a[i]!, a: ++i });
  while (j < m) out.push({ kind: "add", text: b[j]!, b: ++j });
  return out;
}

export function fakeHash(seed: string, len = 64) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const r = mulberry32(h);
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
