import { createClient } from "@/lib/supabase/client";
import { RETENTION_MINUTES } from "./plans";
import { fileExt } from "./utils";
import type { JobResult } from "./types";

/** Start of the current local day as an ISO timestamp (for daily quota windows). */
export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  zip: "application/zip",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

/** Best-effort MIME type from a filename extension. */
export function guessMime(filename: string): string {
  return MIME_BY_EXT[fileExt(filename)] ?? "application/octet-stream";
}

/**
 * Persist a completed conversion (and its output file) to Supabase so it shows
 * up in the dashboard's history and counts toward usage/quota. RLS ties the
 * rows to the signed-in user. Best-effort: failures are swallowed by the caller.
 */
export async function recordConversion(
  userId: string,
  args: { tool: string; sourceFile?: string; result: JobResult },
): Promise<void> {
  const supabase = createClient();
  const { tool, sourceFile, result } = args;
  const status = result.status === "failed" ? "failed" : "completed";

  await supabase.from("conversions").insert({
    user_id: userId,
    tool,
    source_file: sourceFile ?? null,
    output_file: result.output_filename ?? null,
    status,
    completed_at: new Date().toISOString(),
  });

  // Record the downloadable output as a retained file (auto-expires).
  if (status === "completed" && result.output_filename) {
    await supabase.from("files").insert({
      user_id: userId,
      filename: result.output_filename,
      size: result.output_size ?? 0,
      type: guessMime(result.output_filename),
      status: "ready",
      storage_path: result.download_url ?? null,
      expires_at: new Date(Date.now() + RETENTION_MINUTES * 60_000).toISOString(),
    });
  }
}
