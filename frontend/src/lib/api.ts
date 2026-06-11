import type { JobResult } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export interface RunToolArgs {
  endpoint: string;
  files: File[];
  options?: Record<string, string | number | boolean>;
  /** 0..100 upload progress callback. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  /** Optional bearer token for authenticated requests. */
  token?: string;
  /** Frontend tool slug, sent so the backend can record history accurately. */
  toolSlug?: string;
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
  signal,
  token,
  toolSlug,
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
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (toolSlug) xhr.setRequestHeader("X-Tool-Slug", toolSlug);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

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
      reject(new Error("Network error — is the backend running and reachable?"));
    xhr.ontimeout = () => reject(new Error("The request timed out."));

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
