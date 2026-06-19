import type { JobResult } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export interface RunToolArgs {
  endpoint: string;
  files: File[];
  options?: Record<string, string | number | boolean>;
  /** 0..100 upload progress callback. */
  onProgress?: (percent: number) => void;
  /** Fires once the request body has finished uploading (processing begins). */
  onUploadDone?: () => void;
  signal?: AbortSignal;
  /** Optional bearer token for authenticated requests. */
  token?: string;
  /** Frontend tool slug, sent so the backend can record history accurately. */
  toolSlug?: string;
  /** Client-generated id so the backend can stream this job's progress (SSE). */
  jobId?: string;
}

/**
 * Posts files + options to a backend processing endpoint as multipart/form-data.
 * Uses XMLHttpRequest so we can report real upload progress, then resolves with
 * the parsed JobResult JSON envelope.
 */
export function runTool({
  endpoint,
  files,
  options = {},
  onProgress,
  onUploadDone,
  signal,
  token,
  toolSlug,
  jobId,
}: RunToolArgs): Promise<JobResult> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const form = new FormData();
    for (const file of files) form.append("files", file, file.name);
    for (const [key, value] of Object.entries(options)) {
      form.append(key, String(value));
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    // Heavy conversions (documents via LibreOffice, video, AI) can be slow —
    // allow up to 3 min before declaring the request hung.
    xhr.timeout = 180_000;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (toolSlug) xhr.setRequestHeader("X-Tool-Slug", toolSlug);
    if (jobId) xhr.setRequestHeader("X-Job-Id", jobId);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    // Body fully uploaded → server-side processing starts now.
    xhr.upload.onload = () => onUploadDone?.();

    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = { detail: xhr.responseText };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as JobResult);
      } else {
        const detail =
          (body as { detail?: string })?.detail || `Request failed (${xhr.status})`;
        reject(new Error(detail));
      }
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Couldn't reach the server — it may be waking up or briefly busy. Please wait a moment and try again.",
        ),
      );
    xhr.ontimeout = () =>
      reject(
        new Error("The server took too long to respond (it may be busy). Please try again in a moment."),
      );

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort());
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    }

    xhr.send(form);
  });
}

/** Resolve a backend-relative download path to an absolute URL. */
export function downloadUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Trigger a browser download for a given URL + filename. */
export function triggerDownload(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
