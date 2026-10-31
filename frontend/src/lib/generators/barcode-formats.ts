/** A barcode symbology as offered in the generator (bwip-js `bcid`). */
export interface BarcodeFormat {
  bcid: string;
  label: string;
  group: string;
  sample: string;
  hint: string;
  /** 2D / stacked symbols: no bar height or human-readable text options. */
  twoD?: boolean;
  /** Extra bwip-js options the symbology needs. */
  opts?: Record<string, string | boolean>;
}

const RETAIL = "Retail & products";
const GENERAL = "General purpose";
const LOGISTICS = "GS1 & logistics";
const TWO_D = "2D codes";

/** Curated formats shown first; every other bwip-js symbology is offered under "All formats". */
export const BARCODE_FORMATS: BarcodeFormat[] = [
  { bcid: "ean13", label: "EAN-13", group: RETAIL, sample: "590123412345", hint: "12 digits (the check digit is added for you) or 13 digits. Add a 2- or 5-digit add-on after a space.", opts: { guardwhitespace: true } },
  { bcid: "ean8", label: "EAN-8", group: RETAIL, sample: "9638507", hint: "7 digits (+ automatic check digit) or 8 digits.", opts: { guardwhitespace: true } },
  { bcid: "upca", label: "UPC-A", group: RETAIL, sample: "01234567890", hint: "11 digits (+ automatic check digit) or 12 digits.", opts: { guardwhitespace: true } },
  { bcid: "upce", label: "UPC-E", group: RETAIL, sample: "0123456", hint: "7 digits starting with 0 or 1 (+ automatic check digit), or 8 digits.", opts: { guardwhitespace: true } },
  { bcid: "isbn", label: "ISBN (books)", group: RETAIL, sample: "978-1-56581-231-4", hint: "ISBN-13 with hyphens, e.g. 978-1-56581-231-4.", opts: { guardwhitespace: true } },
  { bcid: "code128", label: "Code 128", group: GENERAL, sample: "AIO-12345", hint: "Any letters, digits and symbols — the most widely used 1D barcode." },
  { bcid: "code39", label: "Code 39", group: GENERAL, sample: "CODE-39", hint: "Uppercase A–Z, digits, space and - . $ / + %." },
  { bcid: "code93", label: "Code 93", group: GENERAL, sample: "CODE93", hint: "Uppercase A–Z, digits, space and - . $ / + % (more compact than Code 39)." },
  { bcid: "interleaved2of5", label: "Interleaved 2 of 5", group: GENERAL, sample: "0123456789", hint: "Digits only, an even number of them." },
  { bcid: "rationalizedCodabar", label: "Codabar", group: GENERAL, sample: "A40156B", hint: "Digits and - $ : / . +, starting and ending with A, B, C or D." },
  { bcid: "msi", label: "MSI Plessey", group: GENERAL, sample: "0123456", hint: "Digits only." },
  { bcid: "pharmacode", label: "Pharmacode", group: GENERAL, sample: "117480", hint: "A whole number from 3 to 131070." },
  { bcid: "gs1-128", label: "GS1-128", group: LOGISTICS, sample: "(01)09521234543213(3103)000123", hint: "GS1 Application Identifiers in brackets, e.g. (01)GTIN (10)batch (17)expiry." },
  { bcid: "itf14", label: "ITF-14 (cartons)", group: LOGISTICS, sample: "0460123456789", hint: "13 digits (+ automatic check digit) or 14 digits." },
  { bcid: "datamatrix", label: "Data Matrix", group: TWO_D, sample: "https://example.com", hint: "Any text — compact 2D code used on electronics and parts.", twoD: true },
  { bcid: "gs1datamatrix", label: "GS1 Data Matrix", group: TWO_D, sample: "(01)09521234543213(17)301231(10)ABC123", hint: "GS1 Application Identifiers in brackets (pharma, healthcare).", twoD: true },
  { bcid: "pdf417", label: "PDF417", group: TWO_D, sample: "All in one converter", hint: "Any text — used on ID cards, boarding passes and shipping labels.", twoD: true },
  { bcid: "azteccode", label: "Aztec", group: TWO_D, sample: "Hello Aztec", hint: "Any text — used on transport tickets.", twoD: true },
];

export const ALL_FORMATS_GROUP = "All formats";

const TWO_D_PATTERN = /datamatrix|qr|aztec|pdf417|maxicode|dotcode|hanxin|code16k|code49|codeone|ultracode|codablock|jabcode/i;

/** Turn a bwip-js symbolList entry into a generator format. */
export function formatFromSymbol(s: { bcid: string; desc: string; text: string; opts: string }): BarcodeFormat {
  return {
    bcid: s.bcid,
    label: s.desc,
    group: ALL_FORMATS_GROUP,
    sample: s.text,
    hint: `Example: ${s.text.length > 60 ? `${s.text.slice(0, 60)}…` : s.text}`,
    twoD: TWO_D_PATTERN.test(s.bcid),
    opts: parseOpts(s.opts),
  };
}

/** "includetext mode=2 parse" → { includetext: true, mode: "2", parse: true } */
function parseOpts(spec: string): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const token of spec.split(/\s+/).filter(Boolean)) {
    const eq = token.indexOf("=");
    if (eq === -1) out[token] = true;
    else out[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return out;
}

/** "bwipp.ean13badCheckDigit#6915: Incorrect EAN-13 check digit provided" → the readable part. */
export function barcodeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const i = msg.indexOf(": ");
  return i === -1 ? msg : msg.slice(i + 2);
}
