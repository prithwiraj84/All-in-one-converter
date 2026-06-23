/**
 * REST API reference data — the single source for the /api-docs page.
 * Mirrors the actual backend endpoints (verified against the routers/services).
 */

export interface ApiField {
  name: string;
  required: boolean;
  type: string;
  default?: string;
  allowed?: string[];
  description: string;
}

export interface ApiEndpoint {
  method: "POST";
  path: string;
  summary: string;
  /** "file" → downloadable result; "text" → inline `text` field. */
  result: "file" | "text";
  fields: ApiField[];
}

export interface ApiCategory {
  name: string;
  blurb: string;
  endpoints: ApiEndpoint[];
}

const FILES = (desc: string): ApiField => ({ name: "files", required: true, type: "file[]", description: desc });

export const API_REFERENCE: ApiCategory[] = [
  {
    name: "PDF",
    blurb: "Merge, split, compress, secure and annotate PDF files.",
    endpoints: [
      { method: "POST", path: "/api/pdf/merge", summary: "Merge 2+ PDFs into one (upload order).", result: "file", fields: [FILES("Two or more .pdf files (min 2).")] },
      { method: "POST", path: "/api/pdf/split", summary: "Extract page ranges, or split every page into a ZIP.", result: "file", fields: [FILES("One .pdf."), { name: "ranges", required: false, type: "string", default: "", description: "Pages like '1-3, 5, 8-10' (1-based). Empty = one PDF per page, returned as a ZIP." }] },
      { method: "POST", path: "/api/pdf/compress", summary: "Compress / optimize a PDF.", result: "file", fields: [FILES("One .pdf."), { name: "level", required: false, type: "string", default: "recommended", allowed: ["recommended", "extreme"], description: "Image streams are deflated for both levels; 'extreme' is more aggressive." }] },
      { method: "POST", path: "/api/pdf/rotate", summary: "Rotate every page by an angle.", result: "file", fields: [FILES("One .pdf."), { name: "angle", required: false, type: "integer", default: "90", description: "Degrees, applied as angle % 360 (e.g. 90, 180, 270)." }] },
      { method: "POST", path: "/api/pdf/protect", summary: "Encrypt a PDF with AES-256.", result: "file", fields: [FILES("One .pdf."), { name: "password", required: true, type: "string", description: "Password to encrypt with." }] },
      { method: "POST", path: "/api/pdf/unlock", summary: "Remove password protection.", result: "file", fields: [FILES("One (possibly encrypted) .pdf."), { name: "password", required: false, type: "string", default: "", description: "Current password. Wrong password → code 'bad_password'." }] },
      { method: "POST", path: "/api/pdf/page-numbers", summary: "Stamp sequential page numbers.", result: "file", fields: [FILES("One .pdf."), { name: "position", required: false, type: "string", default: "bottom-center", allowed: ["bottom-center", "bottom-right", "bottom-left", "top-center", "top-right"], description: "Where to place the number." }, { name: "start", required: false, type: "integer", default: "1", description: "Number of the first page." }] },
      { method: "POST", path: "/api/pdf/watermark", summary: "Overlay a diagonal text watermark.", result: "file", fields: [FILES("One .pdf."), { name: "text", required: false, type: "string", default: "CONFIDENTIAL", description: "Watermark text." }, { name: "opacity", required: false, type: "integer", default: "30", description: "Opacity percent 0–100." }] },
    ],
  },
  {
    name: "Image",
    blurb: "Convert, resize and compress images. Accepts jpg, png, webp, gif, bmp, tiff. Multiple inputs return a ZIP.",
    endpoints: [
      { method: "POST", path: "/api/image/convert", summary: "Convert image(s) to another format.", result: "file", fields: [FILES("One or more images."), { name: "target", required: false, type: "string", default: "png", allowed: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff"], description: "Output format." }] },
      { method: "POST", path: "/api/image/resize", summary: "Resize image(s) and output as PNG or JPG.", result: "file", fields: [FILES("One or more images."), { name: "width", required: false, type: "integer", default: "1280", description: "Target width (px)." }, { name: "height", required: false, type: "integer", default: "720", description: "Target height (px)." }, { name: "target", required: false, type: "string", default: "png", allowed: ["png", "jpg"], description: "Output format." }, { name: "keep_ratio", required: false, type: "boolean", default: "true", description: "true = fit within W×H keeping aspect; false = exact W×H." }] },
      { method: "POST", path: "/api/image/compress", summary: "Compress image(s) at a quality level.", result: "file", fields: [FILES("One or more images."), { name: "quality", required: false, type: "integer", default: "80", description: "Quality 1–100." }] },
    ],
  },
  {
    name: "Document",
    blurb: "Convert between PDF and Office documents (LibreOffice / PyMuPDF).",
    endpoints: [
      { method: "POST", path: "/api/document/pdf-to-word", summary: "PDF → DOCX.", result: "file", fields: [FILES("One .pdf.")] },
      { method: "POST", path: "/api/document/word-to-pdf", summary: "Word/text → PDF (.doc .docx .odt .rtf .txt).", result: "file", fields: [FILES("One document.")] },
      { method: "POST", path: "/api/document/pdf-to-excel", summary: "Extract PDF tables → XLSX.", result: "file", fields: [FILES("One .pdf.")] },
      { method: "POST", path: "/api/document/excel-to-pdf", summary: "Spreadsheet → PDF (.xls .xlsx .ods .csv).", result: "file", fields: [FILES("One spreadsheet.")] },
      { method: "POST", path: "/api/document/ppt-to-pdf", summary: "Presentation → PDF (.ppt .pptx .odp).", result: "file", fields: [FILES("One presentation.")] },
    ],
  },
  {
    name: "Audio",
    blurb: "Transcode audio with FFmpeg. Accepts mp3, wav, ogg, flac, aac, m4a.",
    endpoints: [
      { method: "POST", path: "/api/audio/convert", summary: "Convert audio to another format.", result: "file", fields: [FILES("One audio file."), { name: "target", required: false, type: "string", default: "mp3", allowed: ["mp3", "wav", "ogg", "flac", "aac", "m4a"], description: "Output format." }] },
    ],
  },
  {
    name: "Video",
    blurb: "Transcode video with FFmpeg. Accepts mp4, webm, mov, avi, mkv.",
    endpoints: [
      { method: "POST", path: "/api/video/convert", summary: "Transcode video, or export to GIF.", result: "file", fields: [FILES("One video file."), { name: "target", required: false, type: "string", default: "mp4", allowed: ["mp4", "webm", "mov", "avi", "mkv", "gif"], description: "Output format ('gif' makes an animated GIF)." }] },
    ],
  },
  {
    name: "OCR",
    blurb: "Extract text from images and PDFs (Tesseract). Returns inline text.",
    endpoints: [
      { method: "POST", path: "/api/ocr/image", summary: "OCR an image → text.", result: "text", fields: [FILES("One image."), { name: "lang", required: false, type: "string", default: "eng", description: "Tesseract language code(s), e.g. 'eng' or 'eng+fra' (requires the lang pack installed)." }] },
      { method: "POST", path: "/api/ocr/pdf", summary: "Extract PDF text (embedded, else OCR scanned pages).", result: "text", fields: [FILES("One .pdf."), { name: "lang", required: false, type: "string", default: "eng", description: "Language code(s) used for the scanned-PDF OCR fallback." }] },
    ],
  },
  {
    name: "Archive",
    blurb: "Repackage and extract archives. Accepts zip, tar, gz, tgz, rar, 7z.",
    endpoints: [
      { method: "POST", path: "/api/archive/convert", summary: "Convert an archive to another container.", result: "file", fields: [FILES("One archive."), { name: "target", required: false, type: "string", default: "zip", allowed: ["zip", "tar", "tar.gz"], description: "Target container." }] },
      { method: "POST", path: "/api/archive/extract", summary: "Extract an archive (returns its files).", result: "file", fields: [FILES("One archive.")] },
    ],
  },
  {
    name: "Font",
    blurb: "Convert fonts (fontTools). Accepts ttf, otf, woff, woff2.",
    endpoints: [
      { method: "POST", path: "/api/font/convert", summary: "Convert a font between formats.", result: "file", fields: [FILES("One font file."), { name: "target", required: false, type: "string", default: "woff2", allowed: ["ttf", "otf", "woff", "woff2"], description: "Target format." }] },
    ],
  },
  {
    name: "AI",
    blurb: "AI-powered tools. Some need server-side engines/keys; outputs are files or inline text.",
    endpoints: [
      { method: "POST", path: "/api/ai/summarize", summary: "Summarize a document (extractive).", result: "text", fields: [FILES("One .pdf or .txt."), { name: "max_sentences", required: false, type: "integer", default: "7", description: "Max sentences in the summary." }] },
      { method: "POST", path: "/api/ai/remove-background", summary: "Remove an image background (rembg).", result: "file", fields: [FILES("One image."), { name: "model", required: false, type: "string", default: "general", allowed: ["general", "portrait", "fast"], description: "Segmentation model." }, { name: "background", required: false, type: "string", default: "transparent", allowed: ["transparent", "white", "black", "green", "blue"], description: "Output background." }, { name: "edges", required: false, type: "boolean", default: "false", description: "Alpha matting for smoother edges (slower)." }] },
      { method: "POST", path: "/api/ai/upscale", summary: "Upscale / enhance an image.", result: "file", fields: [FILES("One image (≤ ~40 MP)."), { name: "scale", required: false, type: "integer", default: "2", allowed: ["2", "3", "4"], description: "Upscale factor (output edge capped at 8000px)." }, { name: "denoise", required: false, type: "boolean", default: "false", description: "OpenCV denoise before resizing." }, { name: "sharpen", required: false, type: "boolean", default: "true", description: "Unsharp mask after resizing." }] },
      { method: "POST", path: "/api/ai/restore", summary: "Restore / colorize a photo.", result: "file", fields: [FILES("One image."), { name: "colorize", required: false, type: "boolean", default: "false", description: "Colorize a grayscale photo (downloads a model on first use)." }, { name: "enhance", required: false, type: "boolean", default: "true", description: "Denoise + autocontrast + sharpen + color boost." }] },
      { method: "POST", path: "/api/ai/caption", summary: "Alt-text / caption / SEO keywords (vision LLM).", result: "text", fields: [FILES("One image."), { name: "style", required: false, type: "string", default: "alt", allowed: ["alt", "detailed", "keywords"], description: "Output style." }, { name: "language", required: false, type: "string", default: "English", description: "Output language (free-form)." }] },
      { method: "POST", path: "/api/ai/transcribe", summary: "Speech-to-text (Whisper).", result: "text", fields: [FILES("One audio/video file."), { name: "language", required: false, type: "string", default: "auto", description: "Source language code, or 'auto'." }, { name: "translate", required: false, type: "boolean", default: "false", description: "Translate the output to English." }] },
      { method: "POST", path: "/api/ai/subtitles", summary: "Generate SRT / WebVTT subtitles (Whisper).", result: "file", fields: [FILES("One audio/video file."), { name: "format", required: false, type: "string", default: "srt", allowed: ["srt", "vtt"], description: "Subtitle format." }, { name: "language", required: false, type: "string", default: "auto", description: "Source language code, or 'auto'." }, { name: "translate", required: false, type: "boolean", default: "false", description: "Translate to English." }] },
      { method: "POST", path: "/api/ai/text-to-speech", summary: "Document text → speech (edge-tts).", result: "file", fields: [FILES("One .pdf, .docx or .txt (text truncated to 20k chars)."), { name: "voice", required: false, type: "string", default: "en-US-JennyNeural", description: "Neural voice name." }, { name: "speed", required: false, type: "string", default: "normal", allowed: ["slow", "normal", "fast"], description: "Speaking rate." }] },
      { method: "POST", path: "/api/ai/translate", summary: "Translate a document.", result: "file", fields: [FILES("One .pdf, .docx or .txt."), { name: "target", required: false, type: "string", default: "es", allowed: ["en", "es", "fr", "de", "it", "pt", "nl", "ru", "ar", "hi", "bn", "zh-CN", "ja", "ko", "tr", "vi", "id", "pl", "uk", "fa"], description: "Target language." }, { name: "source", required: false, type: "string", default: "auto", description: "Source language, or 'auto'." }, { name: "format", required: false, type: "string", default: "docx", allowed: ["docx", "txt"], description: "Output file format." }] },
    ],
  },
];

export interface ResponseField {
  name: string;
  type: string;
  description: string;
}

export const RESPONSE_FIELDS: ResponseField[] = [
  { name: "job_id", type: "string", description: "Unique job id (hex). Always present on success." },
  { name: "tool", type: "string", description: "Tool slug, e.g. \"merge-pdf\"." },
  { name: "status", type: "string", description: "\"completed\" on a successful synchronous job." },
  { name: "download_url", type: "string | null", description: "Relative path to the output: /api/files/download/{job_id}/{filename}. null for text results." },
  { name: "output_filename", type: "string | null", description: "Output file name. null for text results." },
  { name: "output_size", type: "number | null", description: "Output size in bytes. null for text results." },
  { name: "files", type: "array | null", description: "For multi-file outputs: [{ name, download_url, size }]. null otherwise." },
  { name: "text", type: "string | null", description: "Inline text result (OCR / AI tools). null for file tools." },
  { name: "meta", type: "object | null", description: "Tool-specific metadata (e.g. detected language, page count)." },
];

export interface ApiError {
  status: number;
  code?: string;
  meaning: string;
  when: string;
}

export const API_ERRORS: ApiError[] = [
  { status: 400, meaning: "Bad request", when: "No files uploaded, or fewer than the minimum required (e.g. merge needs 2)." },
  { status: 401, meaning: "Unauthorized", when: "Missing, invalid or revoked API key." },
  { status: 403, meaning: "Forbidden", when: "The key's owner is not on the Business plan." },
  { status: 413, meaning: "Payload too large", when: "File exceeds your plan's per-file limit, or your storage cap would be exceeded." },
  { status: 415, meaning: "Unsupported media type", when: "The file extension isn't accepted by that tool." },
  { status: 422, code: "processing_error", meaning: "Unprocessable", when: "The file couldn't be processed (corrupt input, conversion failed, no output produced)." },
  { status: 422, meaning: "Validation error", when: "A required form field is missing or has the wrong type (FastAPI validation; detail is a list)." },
  { status: 429, code: "rate_limited", meaning: "Too many requests", when: "More than 60 requests/min from one IP. Honor the Retry-After header." },
  { status: 429, meaning: "Daily limit reached", when: "Free plan only (5/day). Business is unlimited — you won't hit this." },
  { status: 500, code: "internal_error", meaning: "Server error", when: "An unexpected error. Safe to retry once." },
  { status: 503, code: "server_busy", meaning: "Busy", when: "Concurrency backpressure under load. Retry after a few seconds (Retry-After: 5)." },
  { status: 503, code: "binary_not_found", meaning: "Engine missing", when: "A required tool (FFmpeg, Tesseract, LibreOffice…) isn't installed on the server." },
  { status: 504, code: "timeout", meaning: "Timed out", when: "Processing took too long — try a smaller file." },
];

export interface PlanQuota {
  plan: string;
  fileSize: string;
  storage: string;
  tasks: string;
  retention: string;
}

export const PLAN_QUOTAS: PlanQuota[] = [
  { plan: "Free", fileSize: "10 MB", storage: "100 MB", tasks: "5 / day", retention: "60 min" },
  { plan: "Pro", fileSize: "1 GB", storage: "2 GB", tasks: "Unlimited", retention: "1 day" },
  { plan: "Business", fileSize: "1 GB", storage: "20 GB", tasks: "Unlimited", retention: "1 day" },
];
