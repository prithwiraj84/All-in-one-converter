/**
 * In-browser image processing via Canvas — convert, resize, compress.
 * Runs entirely on the user's device (private + instant, no server load).
 * Returns `null` to signal "can't do this in the browser" so the caller falls
 * back to the server (e.g. GIF/BMP/TIFF *output*, or TIFF *input*).
 */
import type { ClientFile, ClientOptions } from "./types";

// Canvas can only ENCODE these. (It can decode more, incl. gif/bmp.)
const ENCODABLE = new Set(["png", "jpg", "jpeg", "webp"]);

function targetMime(target: string): string {
  if (target === "jpg" || target === "jpeg") return "image/jpeg";
  if (target === "webp") return "image/webp";
  return "image/png";
}

function extFor(target: string): string {
  return target === "jpeg" ? "jpg" : target;
}

function replaceExt(name: string, ext: string): string {
  const dot = name.lastIndexOf(".");
  return `${dot === -1 ? name : name.slice(0, dot)}.${ext}`;
}

function inputExt(name: string): string {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  return e === "jpeg" ? "jpg" : e;
}

/** Decode a file to an ImageBitmap, or null if the browser can't (e.g. TIFF). */
async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

async function encode(
  bmp: ImageBitmap,
  width: number,
  height: number,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // JPEG has no alpha — flatten onto white so transparency doesn't go black.
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

export async function convertImages(
  files: File[],
  options: ClientOptions,
): Promise<ClientFile[] | null> {
  const target = String(options.target ?? "png").toLowerCase();
  if (!ENCODABLE.has(target)) return null; // gif/bmp/tiff output → server
  const mime = targetMime(target);
  const ext = extFor(target);

  const out: ClientFile[] = [];
  for (const file of files) {
    const bmp = await decode(file);
    if (!bmp) return null; // undecodable input (e.g. TIFF) → server
    const blob = await encode(bmp, bmp.width, bmp.height, mime, 0.92);
    bmp.close?.();
    if (!blob) return null;
    out.push({ blob, filename: replaceExt(file.name, ext) });
  }
  return out;
}

export async function resizeImages(
  files: File[],
  options: ClientOptions,
): Promise<ClientFile[] | null> {
  const width = Math.max(1, Number(options.width) || 1280);
  const height = Math.max(1, Number(options.height) || 720);
  const keepRatio = options.keep_ratio !== false && options.keep_ratio !== "false";
  // Output format chosen by the user (PNG or JPG); default PNG.
  const target = String(options.target ?? "png").toLowerCase();
  if (!ENCODABLE.has(target)) return null; // unexpected output → let the server handle it
  const outMime = targetMime(target);
  const outExt = extFor(target);

  const out: ClientFile[] = [];
  for (const file of files) {
    const ext = inputExt(file.name);
    if (!ENCODABLE.has(ext)) return null; // can't decode this input in-browser → server
    const bmp = await decode(file);
    if (!bmp) return null;

    let w = width;
    let h = height;
    if (keepRatio) {
      const scale = Math.min(width / bmp.width, height / bmp.height);
      w = bmp.width * scale;
      h = bmp.height * scale;
    }
    const blob = await encode(bmp, w, h, outMime, 0.92);
    bmp.close?.();
    if (!blob) return null;
    out.push({ blob, filename: replaceExt(file.name, `resized.${outExt}`) });
  }
  return out;
}

export async function compressImages(
  files: File[],
  options: ClientOptions,
): Promise<ClientFile[] | null> {
  const quality = Math.min(1, Math.max(0.1, (Number(options.quality) || 80) / 100));

  const out: ClientFile[] = [];
  for (const file of files) {
    const ext = inputExt(file.name);
    // Lossy quality only meaningfully applies to JPEG/WebP — PNG → server.
    if (ext !== "jpg" && ext !== "webp") return null;
    const bmp = await decode(file);
    if (!bmp) return null;
    const blob = await encode(bmp, bmp.width, bmp.height, targetMime(ext), quality);
    bmp.close?.();
    if (!blob) return null;
    // Only keep the client result if it actually got smaller.
    if (blob.size >= file.size) return null;
    out.push({ blob, filename: replaceExt(file.name, `compressed.${extFor(ext)}`) });
  }
  return out;
}
