/**
 * A processed file the user wanted to download but had to sign in first.
 * Stashed in sessionStorage so it survives the OAuth redirect round-trip,
 * then offered again when they return authenticated.
 */
export interface PendingDownload {
  slug: string;
  /** Absolute download URL. */
  url: string;
  filename?: string;
  /** epoch ms — used to expire alongside the backend's 60-minute retention. */
  createdAt: number;
}

const KEY = "aio:pending-download";
const TTL_MS = 60 * 60 * 1000; // mirror backend FILE_RETENTION_MINUTES

export function setPendingDownload(p: PendingDownload): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode / SSR) — ignore */
  }
}

export function getPendingDownload(slug?: string): PendingDownload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingDownload;
    if (Date.now() - p.createdAt > TTL_MS) {
      clearPendingDownload();
      return null;
    }
    if (slug && p.slug !== slug) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearPendingDownload(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
