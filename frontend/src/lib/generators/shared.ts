import type { Zippable } from "fflate";
import { triggerDownload } from "@/lib/api";

/** Save a Blob as a file download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Bundle files into a ZIP. Already-compressed images are stored, not deflated. */
export async function zipFiles(files: { name: string; data: Uint8Array }[]): Promise<Blob> {
  const { zipSync } = await import("fflate");
  const entries: Zippable = {};
  for (const f of files) entries[f.name] = [f.data, { level: /\.(png|jpe?g|webp)$/i.test(f.name) ? 0 : 6 }];
  return new Blob([zipSync(entries)], { type: "application/zip" });
}

/** Copy a PNG blob to the clipboard. Throws where the browser doesn't support it. */
export async function copyImage(png: Blob): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("Copying images isn't supported in this browser.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

/** Filesystem-safe slug for generated file names. */
export function slugify(text: string, max = 40): string {
  const slug = text
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
  return slug || "code";
}

export function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

/** One CSV cell, quoted when needed. */
export function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** WCAG relative luminance of a #rrggbb color (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
