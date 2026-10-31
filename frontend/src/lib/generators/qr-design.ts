import type {
  CornerDotType,
  CornerSquareType,
  DotType,
  ErrorCorrectionLevel,
  GradientType,
  Options,
  ShapeType,
} from "qr-code-styling";
import { contrastRatio, luminance } from "./shared";

/** Everything about how a QR code looks (independent of what it encodes). */
export interface QrDesign {
  fg: string;
  bg: string;
  transparent: boolean;
  gradient: boolean;
  gradientType: GradientType;
  fg2: string;
  /** Gradient angle in degrees. */
  rotation: number;
  customEyes: boolean;
  eyeColor: string;
  dotType: DotType;
  cornerSquareType: CornerSquareType;
  cornerDotType: CornerDotType;
  shape: ShapeType;
  /** Logo as a data: URL. */
  logo: string | null;
  /** Logo size as a fraction of the code (0.1–0.5). */
  logoSize: number;
  logoMargin: number;
  hideDots: boolean;
  ecl: ErrorCorrectionLevel;
  /** Quiet zone around the code, % of the image size. */
  quietZone: number;
  /** Background corner rounding, 0–50 (%). */
  bgRound: number;
  /** Export size in pixels (square). */
  size: number;
}

export const DEFAULT_QR_DESIGN: QrDesign = {
  fg: "#0f172a",
  bg: "#ffffff",
  transparent: false,
  gradient: false,
  gradientType: "linear",
  fg2: "#7c3aed",
  rotation: 45,
  customEyes: false,
  eyeColor: "#2563eb",
  dotType: "square",
  cornerSquareType: "square",
  cornerDotType: "square",
  shape: "square",
  logo: null,
  logoSize: 0.3,
  logoMargin: 4,
  hideDots: true,
  ecl: "M",
  quietZone: 4,
  bgRound: 0,
  size: 1024,
};

export const QR_PRESETS: { name: string; design: Partial<QrDesign> }[] = [
  {
    name: "Classic",
    design: { fg: "#000000", bg: "#ffffff", gradient: false, customEyes: false, dotType: "square", cornerSquareType: "square", cornerDotType: "square", shape: "square", bgRound: 0 },
  },
  {
    name: "Rounded",
    design: { fg: "#0f172a", gradient: false, customEyes: true, eyeColor: "#2563eb", dotType: "rounded", cornerSquareType: "extra-rounded", cornerDotType: "dot", shape: "square" },
  },
  {
    name: "Dots",
    design: { fg: "#1e293b", gradient: false, customEyes: false, dotType: "dots", cornerSquareType: "dot", cornerDotType: "dot", shape: "square" },
  },
  {
    name: "Brand",
    design: { fg: "#2563eb", fg2: "#7c3aed", gradient: true, gradientType: "linear", rotation: 45, customEyes: false, dotType: "classy-rounded", cornerSquareType: "extra-rounded", cornerDotType: "dot", shape: "square", bgRound: 8 },
  },
  {
    name: "Sunset",
    design: { fg: "#f97316", fg2: "#db2777", gradient: true, gradientType: "radial", customEyes: true, eyeColor: "#9d174d", dotType: "extra-rounded", cornerSquareType: "extra-rounded", cornerDotType: "dot", shape: "square" },
  },
  {
    name: "Circle",
    design: { fg: "#0f766e", gradient: false, customEyes: false, dotType: "dots", cornerSquareType: "extra-rounded", cornerDotType: "dot", shape: "circle", bgRound: 50 },
  },
];

/** qr-code-styling options for `data` rendered at `size` px. JPEG has no alpha,
 *  so a transparent background is flattened onto white for it. */
export function qrStylingOptions(
  d: QrDesign,
  data: string,
  size: number,
  { opaque = false }: { opaque?: boolean } = {},
): Partial<Options> {
  const fill = d.gradient
    ? {
        gradient: {
          type: d.gradientType,
          rotation: (d.rotation * Math.PI) / 180,
          colorStops: [
            { offset: 0, color: d.fg },
            { offset: 1, color: d.fg2 },
          ],
        },
      }
    : { color: d.fg };
  const eyes = d.customEyes ? { color: d.eyeColor } : fill;
  const transparent = d.transparent && !opaque;
  return {
    width: size,
    height: size,
    data,
    shape: d.shape,
    margin: Math.round((d.quietZone / 100) * size),
    image: d.logo || undefined,
    qrOptions: { errorCorrectionLevel: d.ecl },
    imageOptions: {
      hideBackgroundDots: d.hideDots,
      imageSize: d.logoSize,
      margin: Math.round((d.logoMargin * size) / 300),
      saveAsBlob: true,
    },
    dotsOptions: { type: d.dotType, ...fill },
    cornersSquareOptions: { type: d.cornerSquareType, ...eyes },
    cornersDotOptions: { type: d.cornerDotType, ...eyes },
    backgroundOptions: { color: transparent ? "transparent" : d.bg, round: d.bgRound / 100 },
  };
}

/** Plain-language warnings about things that commonly stop a QR code scanning. */
export function qrWarnings(d: QrDesign): string[] {
  const out: string[] = [];
  const bg = d.transparent ? "#ffffff" : d.bg;
  const inks = [d.fg, ...(d.gradient ? [d.fg2] : []), ...(d.customEyes ? [d.eyeColor] : [])];
  if (inks.some((c) => luminance(c) > luminance(bg))) {
    out.push("Light code on a dark background is inverted — many scanners can't read it. Use a darker code color.");
  } else if (inks.some((c) => contrastRatio(c, bg) < 3)) {
    out.push("Low contrast between the code and the background — it may not scan reliably.");
  }
  if (d.transparent) out.push("Transparent background: place the code on a light surface so it scans.");
  if (d.logo && (d.ecl === "L" || d.ecl === "M")) {
    out.push("With a logo, use error correction Q or H so the code still scans.");
  }
  if (d.logo && d.logoSize > 0.4) out.push("Large logos hide too much of the code — keep it under 40%.");
  if (d.quietZone < 2) out.push("A very small margin can make the code hard to scan when printed on busy backgrounds.");
  return out;
}
