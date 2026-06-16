/**
 * In-browser tool handlers. Light tools (images, basic PDF) run entirely on the
 * user's device — instant, private, and zero server load. Each handler returns
 * `null` (or throws) when the browser can't do the job, and the caller falls
 * back to the server transparently.
 */
import type { ClientFile, ClientHandler, ClientOptions } from "./types";
import { compressImages, convertImages, resizeImages } from "./image";
import { mergePdf, pageNumbersPdf, rotatePdf, splitPdf } from "./pdf";

export type { ClientFile, ClientOptions } from "./types";

const HANDLERS: Record<string, ClientHandler> = {
  // ── Images (Canvas) — fixed-target aliases all read options.target ──
  "image-converter": convertImages,
  "webp-converter": convertImages,
  "jpg-to-png": convertImages,
  "png-to-jpg": convertImages,
  "png-to-webp": convertImages,
  "jpg-to-webp": convertImages,
  "webp-to-png": convertImages,
  "webp-to-jpg": convertImages,
  "gif-to-png": convertImages,
  "bmp-to-png": convertImages,
  "tiff-to-png": convertImages, // TIFF won't decode in-browser → server fallback
  "resize-image": resizeImages,
  "compress-image": compressImages,

  // ── PDF (pdf-lib) ──
  "merge-pdf": mergePdf,
  "split-pdf": splitPdf,
  "rotate-pdf": rotatePdf,
  "add-page-numbers": pageNumbersPdf,
};

/** Whether a tool *can* attempt to run in the browser. */
export function isClientTool(slug: string): boolean {
  return slug in HANDLERS;
}

/**
 * Run a tool in the browser. Returns the outputs, or `null` to indicate the
 * caller should fall back to the server (unsupported format or any failure).
 */
export async function runClientTool(
  slug: string,
  files: File[],
  options: ClientOptions,
): Promise<ClientFile[] | null> {
  const handler = HANDLERS[slug];
  if (!handler) return null;
  try {
    const result = await handler(files, options);
    return result && result.length > 0 ? result : null;
  } catch {
    // Encrypted/corrupt input, browser quirk, OOM, etc. — let the server try.
    return null;
  }
}
