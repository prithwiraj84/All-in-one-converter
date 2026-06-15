import {
  Combine,
  Scissors,
  FileDown,
  RotateCw,
  Lock,
  Unlock,
  ListOrdered,
  Droplets,
  FileText,
  FileType2,
  FileSpreadsheet,
  Sheet,
  Presentation,
  Image as ImageIcon,
  Images,
  Scaling,
  Shrink,
  ScanText,
  FileSearch,
  FolderArchive,
  Package,
  AudioLines,
  Film,
  Type,
  Sparkles,
  FileImage,
  type LucideIcon,
} from "lucide-react";
import type { ToolCategory } from "./types";

/* ─────────────────────────────────────────────────────────────
   TOOLS REGISTRY — single source of truth.
   Every tool page (/tools/[slug]), SEO landing page (/[slug]),
   navigation menu, search, and the homepage showcase are generated
   from this data. Add a tool here and it appears everywhere.
   ───────────────────────────────────────────────────────────── */

export type ToolOption =
  | {
      type: "select";
      name: string;
      label: string;
      default: string;
      options: { label: string; value: string }[];
      hidden?: boolean;
    }
  | {
      type: "number";
      name: string;
      label: string;
      default: number;
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
    }
  | { type: "text"; name: string; label: string; default?: string; placeholder?: string }
  | { type: "password"; name: string; label: string; placeholder?: string }
  | { type: "toggle"; name: string; label: string; default: boolean };

export interface Tool {
  slug: string;
  title: string;
  category: ToolCategory;
  /** Short one-liner shown on cards. */
  description: string;
  /** Long marketing copy for the SEO landing page. */
  longDescription: string;
  icon: LucideIcon;
  /** MIME types / extensions accepted by the dropzone. */
  accept: string[];
  /** Whether multiple files can be uploaded at once. */
  multiple: boolean;
  /** Backend endpoint (relative to NEXT_PUBLIC_API_URL). */
  endpoint: string;
  /** Verb shown on the action button, e.g. "Merge". */
  actionLabel: string;
  /** Whether the result is inline text (OCR) vs a downloadable file. */
  resultType: "file" | "text";
  options?: ToolOption[];
  featured?: boolean;
  popular?: boolean;
  seo: { title: string; description: string; keywords: string[] };
  faqs?: { question: string; answer: string }[];
}

export interface CategoryInfo {
  key: ToolCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind gradient classes for category accents. */
  gradient: string;
  accent: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    key: "pdf",
    label: "PDF Tools",
    description: "Merge, split, compress, protect and edit PDF documents.",
    icon: FileText,
    gradient: "from-blue-500 to-indigo-600",
    accent: "text-blue-600",
  },
  {
    key: "document",
    label: "Document Tools",
    description: "Convert between PDF, Word, Excel and PowerPoint.",
    icon: FileType2,
    gradient: "from-violet-500 to-purple-600",
    accent: "text-violet-600",
  },
  {
    key: "image",
    label: "Image Tools",
    description: "Convert, resize and compress images in any format.",
    icon: ImageIcon,
    gradient: "from-cyan-500 to-sky-600",
    accent: "text-cyan-600",
  },
  {
    key: "ocr",
    label: "OCR Tools",
    description: "Extract editable text from images and scanned PDFs.",
    icon: ScanText,
    gradient: "from-emerald-500 to-teal-600",
    accent: "text-emerald-600",
  },
  {
    key: "archive",
    label: "Archive Tools",
    description: "Extract and convert ZIP, TAR and other archives.",
    icon: FolderArchive,
    gradient: "from-amber-500 to-orange-600",
    accent: "text-amber-600",
  },
  {
    key: "audio",
    label: "Audio Tools",
    description: "Convert audio between MP3, WAV, FLAC and more.",
    icon: AudioLines,
    gradient: "from-pink-500 to-rose-600",
    accent: "text-pink-600",
  },
  {
    key: "video",
    label: "Video Tools",
    description: "Convert and optimize video for any platform.",
    icon: Film,
    gradient: "from-red-500 to-orange-600",
    accent: "text-red-600",
  },
  {
    key: "font",
    label: "Font Tools",
    description: "Convert fonts between TTF, OTF, WOFF and WOFF2.",
    icon: Type,
    gradient: "from-slate-500 to-slate-700",
    accent: "text-slate-600",
  },
  {
    key: "ai",
    label: "AI Tools",
    description: "Summarize and understand documents with AI.",
    icon: Sparkles,
    gradient: "from-fuchsia-500 to-purple-600",
    accent: "text-fuchsia-600",
  },
];

const PDF = ["application/pdf"];
const IMG = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"];

export const TOOLS: Tool[] = [
  /* ── PDF ─────────────────────────────────────────────────── */
  {
    slug: "merge-pdf",
    title: "Merge PDF",
    category: "pdf",
    description: "Combine multiple PDFs into a single document in the order you choose.",
    longDescription:
      "Merge PDF lets you combine any number of PDF files into one organized document. Drag to reorder pages, then download a single, clean PDF in seconds — no watermarks, no signup required.",
    icon: Combine,
    accept: PDF,
    multiple: true,
    endpoint: "/api/pdf/merge",
    actionLabel: "Merge PDFs",
    resultType: "file",
    featured: true,
    popular: true,
    seo: {
      title: "Merge PDF — Combine PDF Files Online Free",
      description:
        "Combine multiple PDF files into one document online for free. Fast, secure, and no watermark. Files are deleted automatically after processing.",
      keywords: ["merge pdf", "combine pdf", "join pdf files", "pdf merger online"],
    },
  },
  {
    slug: "split-pdf",
    title: "Split PDF",
    category: "pdf",
    description: "Extract pages or split one PDF into multiple files by page ranges.",
    longDescription:
      "Split PDF breaks a large PDF into smaller documents. Extract specific pages, split by range, or separate every page into its own file. Perfect for sharing just the pages that matter.",
    icon: Scissors,
    accept: PDF,
    multiple: false,
    endpoint: "/api/pdf/split",
    actionLabel: "Split PDF",
    resultType: "file",
    featured: true,
    options: [
      {
        type: "text",
        name: "ranges",
        label: "Page ranges (e.g. 1-3, 5, 8-10)",
        placeholder: "1-3, 5, 8-10",
      },
    ],
    seo: {
      title: "Split PDF — Extract & Separate PDF Pages Online",
      description:
        "Split a PDF into multiple files or extract specific pages online for free. Choose page ranges and download instantly. Secure and private.",
      keywords: ["split pdf", "extract pdf pages", "separate pdf", "pdf splitter"],
    },
  },
  {
    slug: "compress-pdf",
    title: "Compress PDF",
    category: "pdf",
    description: "Reduce PDF file size while keeping the best possible quality.",
    longDescription:
      "Compress PDF shrinks bulky documents so they're easy to email and upload. Pick a compression level and we optimize images and structure while preserving readability.",
    icon: FileDown,
    accept: PDF,
    multiple: false,
    endpoint: "/api/pdf/compress",
    actionLabel: "Compress PDF",
    resultType: "file",
    featured: true,
    popular: true,
    options: [
      {
        type: "select",
        name: "level",
        label: "Compression level",
        default: "recommended",
        options: [
          { label: "Less (best quality)", value: "low" },
          { label: "Recommended", value: "recommended" },
          { label: "Extreme (smallest size)", value: "extreme" },
        ],
      },
    ],
    seo: {
      title: "Compress PDF — Reduce PDF File Size Online Free",
      description:
        "Compress PDF files online to reduce size without losing quality. Free, fast and secure PDF compressor. No watermark, files auto-deleted.",
      keywords: ["compress pdf", "reduce pdf size", "pdf compressor", "shrink pdf"],
    },
  },
  {
    slug: "rotate-pdf",
    title: "Rotate PDF",
    category: "pdf",
    description: "Rotate all or selected pages of a PDF to the correct orientation.",
    longDescription:
      "Rotate PDF fixes sideways or upside-down scans. Turn every page 90, 180, or 270 degrees and save a perfectly oriented document.",
    icon: RotateCw,
    accept: PDF,
    multiple: false,
    endpoint: "/api/pdf/rotate",
    actionLabel: "Rotate PDF",
    resultType: "file",
    options: [
      {
        type: "select",
        name: "angle",
        label: "Rotation",
        default: "90",
        options: [
          { label: "90° clockwise", value: "90" },
          { label: "180°", value: "180" },
          { label: "270° (90° counter-clockwise)", value: "270" },
        ],
      },
    ],
    seo: {
      title: "Rotate PDF — Rotate PDF Pages Online Free",
      description:
        "Rotate PDF pages online for free. Fix the orientation of scanned documents and save instantly. Secure and watermark-free.",
      keywords: ["rotate pdf", "turn pdf pages", "fix pdf orientation"],
    },
  },
  {
    slug: "protect-pdf",
    title: "Protect PDF",
    category: "pdf",
    description: "Add a password and encryption to keep your PDF private.",
    longDescription:
      "Protect PDF encrypts your document with a password so only the right people can open it. Strong AES encryption keeps sensitive files safe.",
    icon: Lock,
    accept: PDF,
    multiple: false,
    endpoint: "/api/pdf/protect",
    actionLabel: "Protect PDF",
    resultType: "file",
    options: [{ type: "password", name: "password", label: "Password", placeholder: "Set a password" }],
    seo: {
      title: "Protect PDF — Password Protect & Encrypt PDF Online",
      description:
        "Add a password to your PDF online for free. Encrypt sensitive documents with strong AES protection. Private and secure.",
      keywords: ["protect pdf", "password protect pdf", "encrypt pdf", "lock pdf"],
    },
  },
  {
    slug: "unlock-pdf",
    title: "Unlock PDF",
    category: "pdf",
    description: "Remove the password from a PDF you own to make it freely accessible.",
    longDescription:
      "Unlock PDF removes password protection from documents you have the rights to open. Enter the current password and download an unrestricted copy.",
    icon: Unlock,
    accept: PDF,
    multiple: false,
    endpoint: "/api/pdf/unlock",
    actionLabel: "Unlock PDF",
    resultType: "file",
    options: [{ type: "password", name: "password", label: "Current password", placeholder: "Enter password" }],
    seo: {
      title: "Unlock PDF — Remove PDF Password Online Free",
      description:
        "Remove password protection from your PDF online for free. Unlock PDFs you own quickly and securely.",
      keywords: ["unlock pdf", "remove pdf password", "decrypt pdf"],
    },
  },
  {
    slug: "add-page-numbers",
    title: "Add Page Numbers",
    category: "pdf",
    description: "Insert clean, customizable page numbers into your PDF.",
    longDescription:
      "Add Page Numbers stamps sequential numbers onto every page of your PDF. Choose the position and format to match your document style.",
    icon: ListOrdered,
    accept: PDF,
    multiple: false,
    endpoint: "/api/pdf/page-numbers",
    actionLabel: "Add Numbers",
    resultType: "file",
    options: [
      {
        type: "select",
        name: "position",
        label: "Position",
        default: "bottom-center",
        options: [
          { label: "Bottom center", value: "bottom-center" },
          { label: "Bottom right", value: "bottom-right" },
          { label: "Bottom left", value: "bottom-left" },
          { label: "Top center", value: "top-center" },
          { label: "Top right", value: "top-right" },
        ],
      },
      { type: "number", name: "start", label: "Start at", default: 1, min: 1 },
    ],
    seo: {
      title: "Add Page Numbers to PDF Online Free",
      description:
        "Add page numbers to your PDF online for free. Choose position and starting number. Fast, secure and watermark-free.",
      keywords: ["add page numbers pdf", "number pdf pages", "pdf page numbering"],
    },
  },
  {
    slug: "watermark-pdf",
    title: "Watermark PDF",
    category: "pdf",
    description: "Stamp a text watermark across every page of your PDF.",
    longDescription:
      "Watermark PDF overlays custom text — like CONFIDENTIAL or DRAFT — across your document. Control the opacity so it's visible without obscuring content.",
    icon: Droplets,
    accept: PDF,
    multiple: false,
    endpoint: "/api/pdf/watermark",
    actionLabel: "Add Watermark",
    resultType: "file",
    options: [
      { type: "text", name: "text", label: "Watermark text", default: "CONFIDENTIAL", placeholder: "Your text" },
      { type: "number", name: "opacity", label: "Opacity %", default: 30, min: 5, max: 100, step: 5, suffix: "%" },
    ],
    seo: {
      title: "Watermark PDF — Add Text Watermark Online Free",
      description:
        "Add a text watermark to your PDF online for free. Customize text and opacity. Protect and brand your documents securely.",
      keywords: ["watermark pdf", "add watermark to pdf", "pdf stamp"],
    },
  },

  /* ── Document ────────────────────────────────────────────── */
  {
    slug: "pdf-to-word",
    title: "PDF to Word",
    category: "document",
    description: "Convert PDF documents into editable Word (.docx) files.",
    longDescription:
      "PDF to Word turns static PDFs into fully editable Word documents, preserving layout, text and formatting so you can keep working without retyping.",
    icon: FileText,
    accept: PDF,
    multiple: false,
    endpoint: "/api/document/pdf-to-word",
    actionLabel: "Convert to Word",
    resultType: "file",
    featured: true,
    popular: true,
    seo: {
      title: "PDF to Word — Convert PDF to DOCX Online Free",
      description:
        "Convert PDF to editable Word documents online for free. Keep the original layout and formatting. Fast, accurate and secure.",
      keywords: ["pdf to word", "pdf to docx", "convert pdf to word", "pdf to word converter"],
    },
  },
  {
    slug: "word-to-pdf",
    title: "Word to PDF",
    category: "document",
    description: "Convert Word documents into universally shareable PDF files.",
    longDescription:
      "Word to PDF converts .doc and .docx files into pixel-perfect PDFs that look the same on every device, ideal for sharing and printing.",
    icon: FileType2,
    accept: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    multiple: false,
    endpoint: "/api/document/word-to-pdf",
    actionLabel: "Convert to PDF",
    resultType: "file",
    featured: true,
    seo: {
      title: "Word to PDF — Convert DOC & DOCX to PDF Online Free",
      description:
        "Convert Word documents to PDF online for free. Preserve fonts, images and layout exactly. Secure and watermark-free.",
      keywords: ["word to pdf", "docx to pdf", "convert word to pdf", "doc to pdf"],
    },
  },
  {
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    category: "document",
    description: "Extract tables from PDFs into editable Excel spreadsheets.",
    longDescription:
      "PDF to Excel pulls tabular data out of your PDFs and into clean .xlsx spreadsheets so you can sort, filter and calculate right away.",
    icon: FileSpreadsheet,
    accept: PDF,
    multiple: false,
    endpoint: "/api/document/pdf-to-excel",
    actionLabel: "Convert to Excel",
    resultType: "file",
    seo: {
      title: "PDF to Excel — Convert PDF to XLSX Online Free",
      description:
        "Convert PDF tables to editable Excel spreadsheets online for free. Accurate extraction, fast and secure.",
      keywords: ["pdf to excel", "pdf to xlsx", "convert pdf to spreadsheet"],
    },
  },
  {
    slug: "excel-to-pdf",
    title: "Excel to PDF",
    category: "document",
    description: "Convert Excel spreadsheets into clean, printable PDF files.",
    longDescription:
      "Excel to PDF renders your spreadsheets into professional PDFs with intact tables and formatting — perfect for reports and sharing.",
    icon: Sheet,
    accept: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    multiple: false,
    endpoint: "/api/document/excel-to-pdf",
    actionLabel: "Convert to PDF",
    resultType: "file",
    seo: {
      title: "Excel to PDF — Convert XLSX to PDF Online Free",
      description:
        "Convert Excel spreadsheets to PDF online for free. Keep tables and formatting intact. Fast, secure and watermark-free.",
      keywords: ["excel to pdf", "xlsx to pdf", "convert spreadsheet to pdf"],
    },
  },
  {
    slug: "ppt-to-pdf",
    title: "PowerPoint to PDF",
    category: "document",
    description: "Convert PowerPoint presentations into shareable PDF slides.",
    longDescription:
      "PowerPoint to PDF converts .ppt and .pptx slide decks into PDFs that preserve every slide, animation frame and image for easy distribution.",
    icon: Presentation,
    accept: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    multiple: false,
    endpoint: "/api/document/ppt-to-pdf",
    actionLabel: "Convert to PDF",
    resultType: "file",
    seo: {
      title: "PowerPoint to PDF — Convert PPT & PPTX to PDF Online",
      description:
        "Convert PowerPoint presentations to PDF online for free. Keep every slide intact. Fast, secure and easy to share.",
      keywords: ["ppt to pdf", "pptx to pdf", "powerpoint to pdf", "convert presentation to pdf"],
    },
  },

  /* ── Image ───────────────────────────────────────────────── */
  {
    slug: "jpg-to-png",
    title: "JPG to PNG",
    category: "image",
    description: "Convert JPG images to lossless PNG with transparency support.",
    longDescription:
      "JPG to PNG converts photos into the lossless PNG format, ideal when you need crisp edges or transparency for logos and graphics.",
    icon: ImageIcon,
    accept: ["image/jpeg"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to PNG",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "png", hidden: true, options: [{ label: "PNG", value: "png" }] }],
    seo: {
      title: "JPG to PNG — Convert JPG to PNG Online Free",
      description:
        "Convert JPG to PNG online for free. Lossless quality with transparency support. Fast, secure batch conversion.",
      keywords: ["jpg to png", "jpeg to png", "convert jpg to png"],
    },
  },
  {
    slug: "png-to-jpg",
    title: "PNG to JPG",
    category: "image",
    description: "Convert PNG images to compact JPG files perfect for the web.",
    longDescription:
      "PNG to JPG compresses transparent PNGs into smaller JPG files with a clean background, reducing size for faster websites and easier sharing.",
    icon: Images,
    accept: ["image/png"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to JPG",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "jpg", hidden: true, options: [{ label: "JPG", value: "jpg" }] }],
    seo: {
      title: "PNG to JPG — Convert PNG to JPG Online Free",
      description:
        "Convert PNG to JPG online for free. Reduce file size for the web. Fast, secure batch image conversion.",
      keywords: ["png to jpg", "png to jpeg", "convert png to jpg"],
    },
  },
  {
    slug: "webp-converter",
    title: "WebP Converter",
    category: "image",
    description: "Convert images to and from modern WebP for smaller files.",
    longDescription:
      "WebP Converter switches images between WebP, PNG and JPG. WebP delivers superior compression for faster-loading websites without quality loss.",
    icon: FileImage,
    accept: IMG,
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert Image",
    resultType: "file",
    options: [
      {
        type: "select",
        name: "target",
        label: "Output format",
        default: "webp",
        options: [
          { label: "WebP", value: "webp" },
          { label: "PNG", value: "png" },
          { label: "JPG", value: "jpg" },
        ],
      },
    ],
    seo: {
      title: "WebP Converter — Convert to & from WebP Online Free",
      description:
        "Convert images to WebP or back to PNG/JPG online for free. Smaller files, faster sites. Secure batch conversion.",
      keywords: ["webp converter", "convert to webp", "webp to png", "webp to jpg"],
    },
  },
  {
    slug: "resize-image",
    title: "Resize Image",
    category: "image",
    description: "Resize images to exact dimensions while keeping them sharp.",
    longDescription:
      "Resize Image scales photos to the exact width and height you need, with optional aspect-ratio locking, for social media, thumbnails and uploads.",
    icon: Scaling,
    accept: IMG,
    multiple: true,
    endpoint: "/api/image/resize",
    actionLabel: "Resize Image",
    resultType: "file",
    options: [
      { type: "number", name: "width", label: "Width", default: 1280, min: 1, suffix: "px" },
      { type: "number", name: "height", label: "Height", default: 720, min: 1, suffix: "px" },
      { type: "toggle", name: "keep_ratio", label: "Maintain aspect ratio", default: true },
    ],
    seo: {
      title: "Resize Image — Change Image Dimensions Online Free",
      description:
        "Resize images online for free to any width and height. Keep aspect ratio and quality. Fast and secure.",
      keywords: ["resize image", "image resizer", "change image size", "scale image"],
    },
  },
  {
    slug: "compress-image",
    title: "Compress Image",
    category: "image",
    description: "Shrink image file size with adjustable quality control.",
    longDescription:
      "Compress Image reduces photo file sizes dramatically while keeping them looking great. Tune the quality slider to balance size and clarity.",
    icon: Shrink,
    accept: IMG,
    multiple: true,
    endpoint: "/api/image/compress",
    actionLabel: "Compress Image",
    resultType: "file",
    options: [{ type: "number", name: "quality", label: "Quality", default: 80, min: 10, max: 100, step: 5, suffix: "%" }],
    seo: {
      title: "Compress Image — Reduce Image File Size Online Free",
      description:
        "Compress images online for free without visible quality loss. Adjustable quality. Fast, secure batch compression.",
      keywords: ["compress image", "image compressor", "reduce image size", "optimize images"],
    },
  },
  {
    slug: "image-converter",
    title: "Image Converter",
    category: "image",
    description: "Convert images between PNG, JPG, WebP, GIF, BMP and TIFF.",
    longDescription:
      "Image Converter transforms images between every common format. Upload any picture and choose your target format for instant, high-quality conversion.",
    icon: Images,
    accept: IMG,
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert Image",
    resultType: "file",
    featured: true,
    popular: true,
    options: [
      {
        type: "select",
        name: "target",
        label: "Output format",
        default: "png",
        options: [
          { label: "PNG", value: "png" },
          { label: "JPG", value: "jpg" },
          { label: "WebP", value: "webp" },
          { label: "GIF", value: "gif" },
          { label: "BMP", value: "bmp" },
          { label: "TIFF", value: "tiff" },
        ],
      },
    ],
    seo: {
      title: "Image Converter — Convert Images Online Free",
      description:
        "Convert images between PNG, JPG, WebP, GIF, BMP and TIFF online for free. Fast, high-quality, secure batch conversion.",
      keywords: ["image converter", "convert image format", "png jpg webp converter"],
    },
  },

  /* ── OCR ─────────────────────────────────────────────────── */
  {
    slug: "image-to-text",
    title: "Image to Text (OCR)",
    category: "ocr",
    description: "Extract editable text from images and screenshots with OCR.",
    longDescription:
      "Image to Text uses optical character recognition to pull readable, copyable text out of photos, screenshots and scans in dozens of languages.",
    icon: ScanText,
    accept: IMG,
    multiple: false,
    endpoint: "/api/ocr/image",
    actionLabel: "Extract Text",
    resultType: "text",
    featured: true,
    seo: {
      title: "Image to Text — Free Online OCR Converter",
      description:
        "Extract text from images online for free with OCR. Convert screenshots, photos and scans into editable text. Fast and accurate.",
      keywords: ["image to text", "ocr online", "extract text from image", "photo to text"],
    },
  },
  {
    slug: "pdf-to-text",
    title: "PDF to Text (OCR)",
    category: "ocr",
    description: "Extract text from PDFs, including scanned documents, with OCR.",
    longDescription:
      "PDF to Text reads both digital and scanned PDFs and returns clean, copyable text. Ideal for digitizing paperwork and making documents searchable.",
    icon: FileSearch,
    accept: PDF,
    multiple: false,
    endpoint: "/api/ocr/pdf",
    actionLabel: "Extract Text",
    resultType: "text",
    featured: true,
    seo: {
      title: "PDF to Text — Extract Text from PDF with OCR Online",
      description:
        "Extract text from PDFs including scanned documents online for free. OCR-powered, fast and accurate. Secure and private.",
      keywords: ["pdf to text", "ocr pdf", "extract text from pdf", "scanned pdf to text"],
    },
  },

  /* ── Archive ─────────────────────────────────────────────── */
  {
    slug: "zip-extractor",
    title: "Archive Extractor",
    category: "archive",
    description: "Extract files from ZIP, RAR, 7z, TAR and TAR.GZ archives.",
    longDescription:
      "Archive Extractor opens ZIP, RAR, 7z, TAR and TAR.GZ archives and gives you the contents back — the file itself when there's one inside, or a single ZIP of everything for multi-file archives. No software to install.",
    icon: FolderArchive,
    accept: [
      "application/zip",
      "application/x-zip-compressed",
      "application/vnd.rar",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
      "application/x-tar",
      "application/gzip",
    ],
    multiple: false,
    endpoint: "/api/archive/extract",
    actionLabel: "Extract Archive",
    resultType: "file",
    seo: {
      title: "Archive Extractor — Extract ZIP, RAR & 7z Online Free",
      description:
        "Extract ZIP, RAR, 7z and TAR archives online for free. Get the files inside, fast and secure — no software to install.",
      keywords: ["archive extractor", "rar extractor", "7z extractor", "unzip online", "extract zip rar 7z"],
    },
  },
  {
    slug: "archive-converter",
    title: "Archive Converter",
    category: "archive",
    description: "Convert archives between ZIP, TAR, TAR.GZ and more.",
    longDescription:
      "Archive Converter repackages your archives into a different format. Convert between ZIP, TAR and gzip-compressed tarballs without losing structure.",
    icon: Package,
    accept: ["application/zip", "application/x-tar", "application/gzip", "application/x-zip-compressed"],
    multiple: false,
    endpoint: "/api/archive/convert",
    actionLabel: "Convert Archive",
    resultType: "file",
    options: [
      {
        type: "select",
        name: "target",
        label: "Output format",
        default: "zip",
        options: [
          { label: "ZIP", value: "zip" },
          { label: "TAR", value: "tar" },
          { label: "TAR.GZ", value: "tar.gz" },
        ],
      },
    ],
    seo: {
      title: "Archive Converter — Convert ZIP, TAR & GZ Online Free",
      description:
        "Convert archives between ZIP, TAR and TAR.GZ online for free. Fast, secure repackaging with no software to install.",
      keywords: ["archive converter", "zip to tar", "convert archive", "tar gz converter"],
    },
  },

  /* ── Audio ───────────────────────────────────────────────── */
  {
    slug: "audio-converter",
    title: "Audio Converter",
    category: "audio",
    description: "Convert audio between MP3, WAV, OGG, FLAC, AAC and M4A.",
    longDescription:
      "Audio Converter transcodes your sound files into any popular format with FFmpeg-grade quality. Perfect for podcasts, music and voice notes.",
    icon: AudioLines,
    accept: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/aac", "audio/mp4", "audio/x-m4a"],
    multiple: false,
    endpoint: "/api/audio/convert",
    actionLabel: "Convert Audio",
    resultType: "file",
    featured: true,
    options: [
      {
        type: "select",
        name: "target",
        label: "Output format",
        default: "mp3",
        options: [
          { label: "MP3", value: "mp3" },
          { label: "WAV", value: "wav" },
          { label: "OGG", value: "ogg" },
          { label: "FLAC", value: "flac" },
          { label: "AAC", value: "aac" },
          { label: "M4A", value: "m4a" },
        ],
      },
    ],
    seo: {
      title: "Audio Converter — Convert MP3, WAV, FLAC Online Free",
      description:
        "Convert audio files between MP3, WAV, OGG, FLAC, AAC and M4A online for free. High quality, fast and secure.",
      keywords: ["audio converter", "convert to mp3", "wav to mp3", "flac converter"],
    },
  },

  /* ── Video ───────────────────────────────────────────────── */
  {
    slug: "video-converter",
    title: "Video Converter",
    category: "video",
    description: "Convert video between MP4, WebM, MOV, AVI, MKV and animated GIF.",
    longDescription:
      "Video Converter transcodes footage into the format you need, from web-friendly MP4 and WebM to animated GIFs. Powered by FFmpeg for reliable quality.",
    icon: Film,
    accept: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"],
    multiple: false,
    endpoint: "/api/video/convert",
    actionLabel: "Convert Video",
    resultType: "file",
    featured: true,
    popular: true,
    options: [
      {
        type: "select",
        name: "target",
        label: "Output format",
        default: "mp4",
        options: [
          { label: "MP4", value: "mp4" },
          { label: "WebM", value: "webm" },
          { label: "MOV", value: "mov" },
          { label: "AVI", value: "avi" },
          { label: "MKV", value: "mkv" },
          { label: "Animated GIF", value: "gif" },
        ],
      },
    ],
    seo: {
      title: "Video Converter — Convert MP4, WebM, MOV Online Free",
      description:
        "Convert video files between MP4, WebM, MOV, AVI, MKV and GIF online for free. High quality, fast and secure.",
      keywords: ["video converter", "convert to mp4", "mov to mp4", "video to gif"],
    },
  },

  /* ── Font ────────────────────────────────────────────────── */
  {
    slug: "font-converter",
    title: "Font Converter",
    category: "font",
    description: "Convert fonts between TTF, OTF, WOFF and WOFF2 formats.",
    longDescription:
      "Font Converter transforms typefaces between desktop and web formats. Convert TTF/OTF to web-ready WOFF2 to speed up your site's typography.",
    icon: Type,
    accept: ["font/ttf", "font/otf", "font/woff", "font/woff2", "application/x-font-ttf"],
    multiple: false,
    endpoint: "/api/font/convert",
    actionLabel: "Convert Font",
    resultType: "file",
    options: [
      {
        type: "select",
        name: "target",
        label: "Output format",
        default: "woff2",
        options: [
          { label: "WOFF2", value: "woff2" },
          { label: "WOFF", value: "woff" },
          { label: "TTF", value: "ttf" },
          { label: "OTF", value: "otf" },
        ],
      },
    ],
    seo: {
      title: "Font Converter — Convert TTF, OTF, WOFF, WOFF2 Online",
      description:
        "Convert fonts between TTF, OTF, WOFF and WOFF2 online for free. Make desktop fonts web-ready. Fast and secure.",
      keywords: ["font converter", "ttf to woff2", "otf to ttf", "web font converter"],
    },
  },

  /* ── AI ──────────────────────────────────────────────────── */
  {
    slug: "ai-summarize",
    title: "AI Document Summarizer",
    category: "ai",
    description: "Summarize long PDFs and documents into key points with AI.",
    longDescription:
      "AI Document Summarizer reads lengthy PDFs and text files and produces a concise, accurate summary with the main takeaways — saving you hours of reading.",
    icon: Sparkles,
    accept: ["application/pdf", "text/plain"],
    multiple: false,
    endpoint: "/api/ai/summarize",
    actionLabel: "Summarize",
    resultType: "text",
    seo: {
      title: "AI Document Summarizer — Summarize PDFs Online Free",
      description:
        "Summarize long PDFs and documents with AI online for free. Get the key points in seconds. Fast, accurate and secure.",
      keywords: ["ai summarizer", "summarize pdf", "document summary ai", "pdf summarizer"],
    },
  },

  /* ── More format conversions (reuse the generic /convert endpoints) ── */

  // Image
  {
    slug: "webp-to-png",
    title: "WebP to PNG",
    category: "image",
    description: "Convert WebP images to widely-supported PNG.",
    longDescription:
      "WebP to PNG converts modern WebP images into universally compatible PNG files, keeping lossless quality and transparency intact.",
    icon: ImageIcon,
    accept: ["image/webp"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to PNG",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "png", hidden: true, options: [{ label: "PNG", value: "png" }] }],
    seo: {
      title: "WebP to PNG — Convert WebP to PNG Online Free",
      description: "Convert WebP images to PNG online for free. Lossless quality with transparency. Fast, secure batch conversion.",
      keywords: ["webp to png", "convert webp to png", "webp converter"],
    },
  },
  {
    slug: "webp-to-jpg",
    title: "WebP to JPG",
    category: "image",
    description: "Convert WebP images to compact, universal JPG files.",
    longDescription:
      "WebP to JPG turns modern WebP pictures into compact JPG files that open everywhere — ideal for sharing and older apps that don't support WebP.",
    icon: Images,
    accept: ["image/webp"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to JPG",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "jpg", hidden: true, options: [{ label: "JPG", value: "jpg" }] }],
    seo: {
      title: "WebP to JPG — Convert WebP to JPG Online Free",
      description: "Convert WebP images to JPG online for free. Universal compatibility, smaller files. Fast and secure.",
      keywords: ["webp to jpg", "webp to jpeg", "convert webp to jpg"],
    },
  },
  {
    slug: "png-to-webp",
    title: "PNG to WebP",
    category: "image",
    description: "Convert PNG images to smaller, modern WebP.",
    longDescription:
      "PNG to WebP compresses PNG images into the modern WebP format for dramatically smaller files and faster-loading websites, with transparency preserved.",
    icon: FileImage,
    accept: ["image/png"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to WebP",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "webp", hidden: true, options: [{ label: "WebP", value: "webp" }] }],
    seo: {
      title: "PNG to WebP — Convert PNG to WebP Online Free",
      description: "Convert PNG to WebP online for free. Much smaller files for faster sites, transparency kept. Secure batch conversion.",
      keywords: ["png to webp", "convert png to webp", "webp converter"],
    },
  },
  {
    slug: "jpg-to-webp",
    title: "JPG to WebP",
    category: "image",
    description: "Convert JPG photos to smaller, modern WebP.",
    longDescription:
      "JPG to WebP re-encodes photos into WebP for superior compression and faster page loads without a visible drop in quality.",
    icon: FileImage,
    accept: ["image/jpeg"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to WebP",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "webp", hidden: true, options: [{ label: "WebP", value: "webp" }] }],
    seo: {
      title: "JPG to WebP — Convert JPG to WebP Online Free",
      description: "Convert JPG to WebP online for free. Smaller photos, faster websites. Fast, secure batch conversion.",
      keywords: ["jpg to webp", "jpeg to webp", "convert jpg to webp"],
    },
  },
  {
    slug: "gif-to-png",
    title: "GIF to PNG",
    category: "image",
    description: "Convert GIF images to high-quality PNG.",
    longDescription:
      "GIF to PNG extracts a crisp, lossless PNG from your GIF image — perfect for editing a single frame or getting a higher-quality still.",
    icon: ImageIcon,
    accept: ["image/gif"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to PNG",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "png", hidden: true, options: [{ label: "PNG", value: "png" }] }],
    seo: {
      title: "GIF to PNG — Convert GIF to PNG Online Free",
      description: "Convert GIF images to PNG online for free. Lossless quality. Fast, secure batch conversion.",
      keywords: ["gif to png", "convert gif to png", "gif converter"],
    },
  },
  {
    slug: "bmp-to-png",
    title: "BMP to PNG",
    category: "image",
    description: "Convert bulky BMP bitmaps to compact PNG.",
    longDescription:
      "BMP to PNG converts large, uncompressed bitmap images into compact, lossless PNG files that are far smaller and supported everywhere.",
    icon: Images,
    accept: ["image/bmp"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to PNG",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "png", hidden: true, options: [{ label: "PNG", value: "png" }] }],
    seo: {
      title: "BMP to PNG — Convert BMP to PNG Online Free",
      description: "Convert BMP bitmaps to PNG online for free. Much smaller files, same quality. Fast and secure.",
      keywords: ["bmp to png", "convert bmp to png", "bitmap to png"],
    },
  },
  {
    slug: "tiff-to-png",
    title: "TIFF to PNG",
    category: "image",
    description: "Convert TIFF scans to web-friendly PNG.",
    longDescription:
      "TIFF to PNG converts high-resolution TIFF scans and images into web-friendly PNG files that open in any browser or app.",
    icon: FileImage,
    accept: ["image/tiff"],
    multiple: true,
    endpoint: "/api/image/convert",
    actionLabel: "Convert to PNG",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "png", hidden: true, options: [{ label: "PNG", value: "png" }] }],
    seo: {
      title: "TIFF to PNG — Convert TIFF to PNG Online Free",
      description: "Convert TIFF images to PNG online for free. Web-friendly and lossless. Fast, secure conversion.",
      keywords: ["tiff to png", "tif to png", "convert tiff to png"],
    },
  },

  // Audio
  {
    slug: "wav-to-mp3",
    title: "WAV to MP3",
    category: "audio",
    description: "Convert WAV audio to compact MP3.",
    longDescription:
      "WAV to MP3 compresses large, uncompressed WAV recordings into small MP3 files that are easy to share and play anywhere, with great quality.",
    icon: AudioLines,
    accept: ["audio/wav", "audio/x-wav"],
    multiple: false,
    endpoint: "/api/audio/convert",
    actionLabel: "Convert to MP3",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "mp3", hidden: true, options: [{ label: "MP3", value: "mp3" }] }],
    seo: {
      title: "WAV to MP3 — Convert WAV to MP3 Online Free",
      description: "Convert WAV to MP3 online for free. Much smaller files, high quality. Fast and secure.",
      keywords: ["wav to mp3", "convert wav to mp3", "audio converter"],
    },
  },
  {
    slug: "mp3-to-wav",
    title: "MP3 to WAV",
    category: "audio",
    description: "Convert MP3 to uncompressed WAV audio.",
    longDescription:
      "MP3 to WAV decodes compressed MP3 files into uncompressed WAV audio for editing, mastering or applications that require lossless input.",
    icon: AudioLines,
    accept: ["audio/mpeg"],
    multiple: false,
    endpoint: "/api/audio/convert",
    actionLabel: "Convert to WAV",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "wav", hidden: true, options: [{ label: "WAV", value: "wav" }] }],
    seo: {
      title: "MP3 to WAV — Convert MP3 to WAV Online Free",
      description: "Convert MP3 to WAV online for free. Uncompressed audio for editing. Fast and secure.",
      keywords: ["mp3 to wav", "convert mp3 to wav", "audio converter"],
    },
  },
  {
    slug: "m4a-to-mp3",
    title: "M4A to MP3",
    category: "audio",
    description: "Convert M4A/AAC audio to universal MP3.",
    longDescription:
      "M4A to MP3 converts Apple/AAC audio files into MP3, the most widely supported format for players, cars and devices everywhere.",
    icon: AudioLines,
    accept: ["audio/mp4", "audio/x-m4a", "audio/aac"],
    multiple: false,
    endpoint: "/api/audio/convert",
    actionLabel: "Convert to MP3",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "mp3", hidden: true, options: [{ label: "MP3", value: "mp3" }] }],
    seo: {
      title: "M4A to MP3 — Convert M4A to MP3 Online Free",
      description: "Convert M4A to MP3 online for free. Universal playback on any device. Fast and secure.",
      keywords: ["m4a to mp3", "convert m4a to mp3", "aac to mp3"],
    },
  },
  {
    slug: "flac-to-mp3",
    title: "FLAC to MP3",
    category: "audio",
    description: "Convert lossless FLAC to compact MP3.",
    longDescription:
      "FLAC to MP3 compresses large lossless FLAC tracks into small MP3 files that play on any device while keeping excellent sound quality.",
    icon: AudioLines,
    accept: ["audio/flac", "audio/x-flac"],
    multiple: false,
    endpoint: "/api/audio/convert",
    actionLabel: "Convert to MP3",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "mp3", hidden: true, options: [{ label: "MP3", value: "mp3" }] }],
    seo: {
      title: "FLAC to MP3 — Convert FLAC to MP3 Online Free",
      description: "Convert FLAC to MP3 online for free. Much smaller files, great quality. Fast and secure.",
      keywords: ["flac to mp3", "convert flac to mp3", "audio converter"],
    },
  },
  {
    slug: "ogg-to-mp3",
    title: "OGG to MP3",
    category: "audio",
    description: "Convert OGG Vorbis audio to universal MP3.",
    longDescription:
      "OGG to MP3 converts OGG Vorbis audio into MP3 for maximum compatibility with players and devices that don't support OGG.",
    icon: AudioLines,
    accept: ["audio/ogg"],
    multiple: false,
    endpoint: "/api/audio/convert",
    actionLabel: "Convert to MP3",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "mp3", hidden: true, options: [{ label: "MP3", value: "mp3" }] }],
    seo: {
      title: "OGG to MP3 — Convert OGG to MP3 Online Free",
      description: "Convert OGG to MP3 online for free. Universal playback. Fast and secure.",
      keywords: ["ogg to mp3", "convert ogg to mp3", "audio converter"],
    },
  },

  // Video
  {
    slug: "mov-to-mp4",
    title: "MOV to MP4",
    category: "video",
    description: "Convert QuickTime MOV videos to universal MP4.",
    longDescription:
      "MOV to MP4 converts Apple QuickTime videos into MP4, the most widely supported video format for web, social media and every device.",
    icon: Film,
    accept: ["video/quicktime"],
    multiple: false,
    endpoint: "/api/video/convert",
    actionLabel: "Convert to MP4",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "mp4", hidden: true, options: [{ label: "MP4", value: "mp4" }] }],
    seo: {
      title: "MOV to MP4 — Convert MOV to MP4 Online Free",
      description: "Convert MOV to MP4 online for free. Universal compatibility for web and social. Fast and secure.",
      keywords: ["mov to mp4", "convert mov to mp4", "quicktime to mp4"],
    },
  },
  {
    slug: "mkv-to-mp4",
    title: "MKV to MP4",
    category: "video",
    description: "Convert MKV videos to widely-supported MP4.",
    longDescription:
      "MKV to MP4 repackages Matroska videos into MP4 so they play on phones, browsers, TVs and editors that don't support MKV.",
    icon: Film,
    accept: ["video/x-matroska"],
    multiple: false,
    endpoint: "/api/video/convert",
    actionLabel: "Convert to MP4",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "mp4", hidden: true, options: [{ label: "MP4", value: "mp4" }] }],
    seo: {
      title: "MKV to MP4 — Convert MKV to MP4 Online Free",
      description: "Convert MKV to MP4 online for free. Plays everywhere. Fast and secure.",
      keywords: ["mkv to mp4", "convert mkv to mp4", "matroska to mp4"],
    },
  },
  {
    slug: "avi-to-mp4",
    title: "AVI to MP4",
    category: "video",
    description: "Convert old AVI videos to modern MP4.",
    longDescription:
      "AVI to MP4 converts legacy AVI footage into compact, modern MP4 that streams smoothly and plays on any device.",
    icon: Film,
    accept: ["video/x-msvideo"],
    multiple: false,
    endpoint: "/api/video/convert",
    actionLabel: "Convert to MP4",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "mp4", hidden: true, options: [{ label: "MP4", value: "mp4" }] }],
    seo: {
      title: "AVI to MP4 — Convert AVI to MP4 Online Free",
      description: "Convert AVI to MP4 online for free. Smaller, modern, universal. Fast and secure.",
      keywords: ["avi to mp4", "convert avi to mp4", "video converter"],
    },
  },
  {
    slug: "webm-to-mp4",
    title: "WebM to MP4",
    category: "video",
    description: "Convert WebM videos to universal MP4.",
    longDescription:
      "WebM to MP4 converts web-optimised WebM videos into MP4 for editing software, social platforms and devices that prefer MP4.",
    icon: Film,
    accept: ["video/webm"],
    multiple: false,
    endpoint: "/api/video/convert",
    actionLabel: "Convert to MP4",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "mp4", hidden: true, options: [{ label: "MP4", value: "mp4" }] }],
    seo: {
      title: "WebM to MP4 — Convert WebM to MP4 Online Free",
      description: "Convert WebM to MP4 online for free. Universal compatibility. Fast and secure.",
      keywords: ["webm to mp4", "convert webm to mp4", "video converter"],
    },
  },
  {
    slug: "video-to-gif",
    title: "Video to GIF",
    category: "video",
    description: "Turn short videos into shareable animated GIFs.",
    longDescription:
      "Video to GIF converts a short clip (MP4, MOV, WebM and more) into a looping animated GIF — perfect for reactions, demos and social posts.",
    icon: Film,
    accept: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"],
    multiple: false,
    endpoint: "/api/video/convert",
    actionLabel: "Convert to GIF",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "gif", hidden: true, options: [{ label: "Animated GIF", value: "gif" }] }],
    seo: {
      title: "Video to GIF — Convert Video to Animated GIF Online Free",
      description: "Convert short videos to animated GIFs online for free. Great for reactions and demos. Fast and secure.",
      keywords: ["video to gif", "mp4 to gif", "convert video to gif"],
    },
  },

  // Archive
  {
    slug: "zip-to-tar",
    title: "ZIP to TAR",
    category: "archive",
    description: "Convert ZIP archives to TAR format.",
    longDescription:
      "ZIP to TAR repackages a ZIP archive into a TAR file, a common format on Linux and Unix systems, keeping the folder structure intact.",
    icon: Package,
    accept: ["application/zip", "application/x-zip-compressed"],
    multiple: false,
    endpoint: "/api/archive/convert",
    actionLabel: "Convert to TAR",
    resultType: "file",
    options: [{ type: "select", name: "target", label: "Output format", default: "tar", hidden: true, options: [{ label: "TAR", value: "tar" }] }],
    seo: {
      title: "ZIP to TAR — Convert ZIP to TAR Online Free",
      description: "Convert ZIP archives to TAR online for free. Keeps structure intact. Fast and secure.",
      keywords: ["zip to tar", "convert zip to tar", "archive converter"],
    },
  },
];

/* ── Derived lookups ─────────────────────────────────────────── */

export const TOOLS_BY_SLUG: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t]),
);

export function getTool(slug: string): Tool | undefined {
  return TOOLS_BY_SLUG[slug];
}

export function toolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export function getCategory(key: ToolCategory): CategoryInfo {
  return CATEGORIES.find((c) => c.key === key)!;
}

export const FEATURED_TOOLS = TOOLS.filter((t) => t.featured);
export const POPULAR_TOOLS = TOOLS.filter((t) => t.popular);
export const ALL_TOOL_SLUGS = TOOLS.map((t) => t.slug);
