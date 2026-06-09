import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable file size from a byte count. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Compact number formatting, e.g. 1_250_000 -> "1.3M". */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Relative time, e.g. "3 minutes ago". */
export function timeAgo(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const ranges: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
    [Infinity, "year"],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let prev = 1;
  for (const [limit, unit] of ranges) {
    if (seconds < limit) {
      return rtf.format(-Math.floor(seconds / prev), unit);
    }
    prev = limit;
  }
  return "just now";
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Title-case a slug like "merge-pdf" -> "Merge Pdf". */
export function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/** Derive a file extension (lowercase, no dot) from a filename. */
export function fileExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

/** Absolute URL helper for SEO metadata. */
export function absoluteUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Tiny promise delay. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
