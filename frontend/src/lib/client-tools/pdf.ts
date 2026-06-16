/**
 * In-browser PDF processing via pdf-lib — merge, split, rotate, page numbers.
 * Runs on the user's device. Returns `null` to fall back to the server when the
 * browser can't handle it (encrypted/corrupt PDFs, the "split every page" case
 * is supported here as multiple files; compress/protect/unlock stay server-side).
 *
 * pdf-lib is dynamically imported so it isn't in the initial bundle.
 */
import type { ClientFile, ClientOptions } from "./types";

function baseName(name: string): string {
  const n = name.split(/[\\/]/).pop() ?? name;
  const dot = n.lastIndexOf(".");
  return dot === -1 ? n : n.slice(0, dot);
}

async function bytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** pdf-lib returns Uint8Array<ArrayBufferLike>; copy into a fresh ArrayBuffer-
 *  backed array so it satisfies BlobPart under strict DOM lib types. */
function pdfBlob(data: Uint8Array): Blob {
  return new Blob([new Uint8Array(data)], { type: "application/pdf" });
}

/** Parse "1-3, 5, 8-10" into sorted 0-based indices within [0, count). */
function parseRanges(spec: string, count: number): number[] {
  const pages = new Set<number>();
  for (const chunk of spec.replace(/\s/g, "").split(",")) {
    if (!chunk) continue;
    if (chunk.includes("-")) {
      const [a, b] = chunk.split("-");
      const start = parseInt(a, 10);
      const end = parseInt(b, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      for (let p = start; p <= end; p++) if (p >= 1 && p <= count) pages.add(p - 1);
    } else {
      const p = parseInt(chunk, 10);
      if (p >= 1 && p <= count) pages.add(p - 1);
    }
  }
  return [...pages].sort((x, y) => x - y);
}

export async function mergePdf(
  files: File[],
  _options: ClientOptions,
): Promise<ClientFile[] | null> {
  if (files.length < 2) return null; // let the server return the friendly error
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const file of files) {
    const src = await PDFDocument.load(await bytes(file)); // throws if encrypted → null
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const data = await out.save();
  return [{ blob: pdfBlob(data), filename: "merged.pdf" }];
}

export async function splitPdf(
  files: File[],
  options: ClientOptions,
): Promise<ClientFile[] | null> {
  const { PDFDocument } = await import("pdf-lib");
  const file = files[0];
  const src = await PDFDocument.load(await bytes(file));
  const count = src.getPageCount();
  const base = baseName(file.name);
  const ranges = String(options.ranges ?? "").trim();

  if (ranges) {
    const indices = parseRanges(ranges, count);
    if (indices.length === 0) return null; // server gives the "no valid pages" error
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    const data = await out.save();
    return [{ blob: pdfBlob(data), filename: `${base}-pages.pdf` }];
  }

  // No ranges → one PDF per page (returned as a downloadable list).
  const result: ClientFile[] = [];
  for (let i = 0; i < count; i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    const data = await out.save();
    result.push({
      blob: pdfBlob(data),
      filename: `${base}-page-${i + 1}.pdf`,
    });
  }
  return result;
}

export async function rotatePdf(
  files: File[],
  options: ClientOptions,
): Promise<ClientFile[] | null> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const angle = ((Number(options.angle) || 90) % 360 + 360) % 360;
  const file = files[0];
  const doc = await PDFDocument.load(await bytes(file));
  doc.getPages().forEach((page) => {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  });
  const data = await doc.save();
  return [
    { blob: pdfBlob(data), filename: `${baseName(file.name)}-rotated.pdf` },
  ];
}

export async function pageNumbersPdf(
  files: File[],
  options: ClientOptions,
): Promise<ClientFile[] | null> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const position = String(options.position ?? "bottom-center");
  const start = Number(options.start) || 1;

  const file = files[0];
  const doc = await PDFDocument.load(await bytes(file));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 11;

  doc.getPages().forEach((page, i) => {
    const text = String(start + i);
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(text, size);
    const margin = 28;
    let x = (width - tw) / 2;
    let y = margin;
    if (position.includes("right")) x = width - tw - margin;
    else if (position.includes("left")) x = margin;
    if (position.includes("top")) y = height - margin;
    page.drawText(text, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
  });

  const data = await doc.save();
  return [
    { blob: pdfBlob(data), filename: `${baseName(file.name)}-numbered.pdf` },
  ];
}
