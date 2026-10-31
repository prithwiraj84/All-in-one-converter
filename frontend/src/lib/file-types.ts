/** Friendly names + extensions for the MIME types tools accept. Extensions let
 *  the dropzone recognise files whose MIME type the OS doesn't report (common
 *  for fonts, archives and some Office files on Windows). */
const MIME_INFO: Record<string, { label: string; exts: string[] }> = {
  "application/pdf": { label: "PDF", exts: [".pdf"] },
  "application/msword": { label: "DOC", exts: [".doc"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "DOCX", exts: [".docx"] },
  "application/vnd.ms-excel": { label: "XLS", exts: [".xls"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { label: "XLSX", exts: [".xlsx"] },
  "application/vnd.ms-powerpoint": { label: "PPT", exts: [".ppt"] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { label: "PPTX", exts: [".pptx"] },
  "text/plain": { label: "TXT", exts: [".txt"] },
  "image/jpeg": { label: "JPG", exts: [".jpg", ".jpeg"] },
  "image/png": { label: "PNG", exts: [".png"] },
  "image/webp": { label: "WEBP", exts: [".webp"] },
  "image/gif": { label: "GIF", exts: [".gif"] },
  "image/bmp": { label: "BMP", exts: [".bmp"] },
  "image/tiff": { label: "TIFF", exts: [".tif", ".tiff"] },
  "audio/mpeg": { label: "MP3", exts: [".mp3"] },
  "audio/wav": { label: "WAV", exts: [".wav"] },
  "audio/x-wav": { label: "WAV", exts: [".wav"] },
  "audio/ogg": { label: "OGG", exts: [".ogg"] },
  "audio/flac": { label: "FLAC", exts: [".flac"] },
  "audio/x-flac": { label: "FLAC", exts: [".flac"] },
  "audio/aac": { label: "AAC", exts: [".aac"] },
  "audio/mp4": { label: "M4A", exts: [".m4a"] },
  "audio/x-m4a": { label: "M4A", exts: [".m4a"] },
  "video/mp4": { label: "MP4", exts: [".mp4"] },
  "video/webm": { label: "WEBM", exts: [".webm"] },
  "video/quicktime": { label: "MOV", exts: [".mov"] },
  "video/x-msvideo": { label: "AVI", exts: [".avi"] },
  "video/x-matroska": { label: "MKV", exts: [".mkv"] },
  "application/zip": { label: "ZIP", exts: [".zip"] },
  "application/x-zip-compressed": { label: "ZIP", exts: [".zip"] },
  "application/x-tar": { label: "TAR", exts: [".tar"] },
  "application/gzip": { label: "GZ", exts: [".gz", ".tgz"] },
  "application/vnd.rar": { label: "RAR", exts: [".rar"] },
  "application/x-rar-compressed": { label: "RAR", exts: [".rar"] },
  "application/x-7z-compressed": { label: "7Z", exts: [".7z"] },
  "font/ttf": { label: "TTF", exts: [".ttf"] },
  "application/x-font-ttf": { label: "TTF", exts: [".ttf"] },
  "font/otf": { label: "OTF", exts: [".otf"] },
  "font/woff": { label: "WOFF", exts: [".woff"] },
  "font/woff2": { label: "WOFF2", exts: [".woff2"] },
};

/** "PDF" / "DOC, DOCX, TXT" — de-duplicated, human-readable format list. */
export function formatLabels(mimes: string[] = []): string[] {
  const labels = mimes.map((m) => MIME_INFO[m]?.label ?? m.split("/").pop()!.split(".").pop()!.toUpperCase());
  return [...new Set(labels)];
}

/** react-dropzone `accept`: each MIME type with its extensions. */
export function dropzoneAccept(mimes: string[] = []): Record<string, string[]> | undefined {
  if (!mimes.length) return undefined;
  return Object.fromEntries(mimes.map((m) => [m, MIME_INFO[m]?.exts ?? []]));
}

/** "PDF", "JPG or PNG", "DOC, DOCX or TXT" */
export function joinFormats(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}
