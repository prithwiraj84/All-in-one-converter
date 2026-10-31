import { CATEGORIES, TOOLS, type Tool } from "./tools-registry";

/** Everyday words people type → the words our tools use. */
const SYNONYMS: Record<string, string[]> = {
  smaller: ["compress"],
  reduce: ["compress"],
  shrink: ["compress"],
  size: ["compress", "resize"],
  combine: ["merge"],
  join: ["merge"],
  separate: ["split"],
  cut: ["split"],
  extract: ["split", "extract"],
  turn: ["rotate"],
  photo: ["image"],
  photos: ["image"],
  picture: ["image"],
  pic: ["image"],
  img: ["image"],
  jpeg: ["jpg"],
  doc: ["word"],
  docx: ["word"],
  xls: ["excel"],
  xlsx: ["excel"],
  sheet: ["excel"],
  spreadsheet: ["excel"],
  powerpoint: ["ppt"],
  pptx: ["ppt"],
  slides: ["ppt"],
  password: ["protect", "unlock"],
  lock: ["protect"],
  secure: ["protect"],
  scan: ["ocr", "text"],
  scanned: ["ocr"],
  movie: ["video"],
  clip: ["video"],
  music: ["audio"],
  song: ["audio"],
  sound: ["audio"],
  voice: ["audio", "speech"],
  speech: ["audio", "speech"],
  rar: ["archive", "zip"],
  unzip: ["zip", "extract"],
  qrcode: ["qr"],
  wifi: ["qr"],
  upi: ["qr"],
  ean: ["barcode"],
  upc: ["barcode"],
  translate: ["translat"],
  language: ["translat"],
  subtitle: ["subtitle"],
  srt: ["subtitle"],
  background: ["background"],
  enhance: ["upscale", "restore"],
  blurry: ["upscale", "restore"],
  old: ["restore"],
  summary: ["summar"],
  read: ["speech", "audio", "text"],
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, `${c.label} ${c.short}`]));

function haystack(t: Tool) {
  return {
    title: normalize(t.title),
    rest: normalize(
      [t.slug.replace(/-/g, " "), t.description, CATEGORY_LABEL[t.category], ...t.seo.keywords].join(" "),
    ),
  };
}

const INDEX = TOOLS.map((tool) => ({ tool, ...haystack(tool) }));

/** Alternatives for one query word: itself, a singular form and synonyms. */
function variants(word: string): string[] {
  const out = new Set([word]);
  if (word.length > 3 && word.endsWith("s")) out.add(word.slice(0, -1));
  for (const w of [...out]) for (const s of SYNONYMS[w] ?? []) out.add(s);
  return [...out];
}

/**
 * Find tools for a plain-language query ("make pdf smaller", "photo to png").
 * Every word must match (title, description, category or keywords); if
 * nothing matches all words, tools matching any word are returned instead.
 * Best matches first. An empty query returns [].
 */
export function searchTools(query: string, limit = Infinity): Tool[] {
  const words = normalize(query)
    .split(" ")
    .filter((w) => w && !["to", "a", "an", "the", "my", "and", "or", "of", "for", "in", "into", "make", "convert", "file", "files", "online", "free"].includes(w));
  if (!words.length) {
    // Only filler words ("convert file") — fall back to matching the raw text.
    const raw = normalize(query);
    if (!raw) return [];
    words.push(...raw.split(" "));
  }

  const score = (entry: (typeof INDEX)[number], requireAll: boolean) => {
    let total = 0;
    let matched = 0;
    for (const word of words) {
      const alts = variants(word);
      if (alts.some((a) => entry.title.includes(a))) {
        total += 3;
        matched++;
      } else if (alts.some((a) => entry.rest.includes(a))) {
        total += 1;
        matched++;
      }
    }
    if (requireAll ? matched < words.length : matched === 0) return 0;
    return total + (entry.tool.popular ? 0.5 : 0) + (entry.tool.featured ? 0.25 : 0);
  };

  for (const requireAll of [true, false]) {
    const hits = INDEX.map((e) => ({ tool: e.tool, s: score(e, requireAll) }))
      .filter((h) => h.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((h) => h.tool);
    if (hits.length) return hits.slice(0, limit);
  }
  return [];
}

/** Example searches shown to first-time visitors. */
export const SEARCH_EXAMPLES = ["Compress PDF", "JPG to PNG", "PDF to Word", "QR code", "Remove background"];
