"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";

/**
 * Premium animated SVG demos for the "See it in action" showcase. Each demo is
 * a self-contained, looping SVG built from a shared 3D design system (gradient
 * surfaces, soft drop shadows, glossy sheen and floating depth) so they read as
 * a coherent, stylish set. Only the active tool's demo is mounted at a time.
 */

// Shared looping transition (kept literal so framer-motion's types are happy).
const loop = (duration: number, delay = 0) => ({
  duration,
  delay,
  repeat: Infinity,
  ease: "easeInOut" as const,
  repeatType: "loop" as const,
});

/* ── Shared gradient / shadow / gloss defs (one set per mounted SVG) ── */
function Defs() {
  return (
    <defs>
      <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#EEF2F8" />
      </linearGradient>
      <linearGradient id="pdfG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FB7185" />
        <stop offset="100%" stopColor="#E11D48" />
      </linearGradient>
      <linearGradient id="wordG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="55%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
      <linearGradient id="success" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="amber" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#BFDBFE" />
        <stop offset="100%" stopColor="#7DD3FC" />
      </linearGradient>
      <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
      </radialGradient>
      <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#1E293B" floodOpacity="0.16" />
      </filter>
    </defs>
  );
}

/* ── Reusable 3D document card ──────────────────────────────────── */
function Doc({
  x,
  y,
  w = 80,
  h = 104,
  grad = "pdfG",
  label = "PDF",
  lines = 4,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  grad?: string;
  label?: string;
  lines?: number;
}) {
  const r = 11;
  return (
    <g filter="url(#soft)">
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#page)" stroke="#E6EBF2" strokeWidth={1} />
      <path
        d={`M${x} ${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + 27} H${x} Z`}
        fill={`url(#${grad})`}
      />
      <text x={x + w / 2} y={y + 18} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="inherit">
        {label}
      </text>
      {Array.from({ length: lines }).map((_, i) => (
        <rect
          key={i}
          x={x + 13}
          y={y + 39 + i * 12.5}
          width={w - 26 - (i % 2 ? 14 : 0)}
          height={4}
          rx={2}
          fill="#DDE5EE"
        />
      ))}
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#sheen)" />
    </g>
  );
}

/* ── Reusable numbered page ─────────────────────────────────────── */
function Page({ x, y, num }: { x: number; y: number; num: number }) {
  return (
    <g filter="url(#soft)">
      <rect x={x} y={y} width={62} height={80} rx={9} fill="url(#page)" stroke="#E6EBF2" />
      <rect x={x + 11} y={y + 13} width={40} height={4} rx={2} fill="#DDE5EE" />
      <rect x={x + 11} y={y + 23} width={40} height={4} rx={2} fill="#DDE5EE" />
      <rect x={x + 11} y={y + 33} width={28} height={4} rx={2} fill="#DDE5EE" />
      <circle cx={x + 31} cy={y + 58} r={11} fill="url(#pdfG)" />
      <text x={x + 31} y={y + 62} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="inherit">
        {num}
      </text>
      <rect x={x} y={y} width={62} height={80} rx={9} fill="url(#sheen)" />
    </g>
  );
}

function Arrow({ x, y }: { x: number; y: number }) {
  return (
    <motion.g animate={{ x: [0, 7, 0], opacity: [0.6, 1, 0.6] }} transition={loop(1.8)}>
      <line x1={x} y1={y} x2={x + 24} y2={y} stroke="url(#brand)" strokeWidth={4.5} strokeLinecap="round" />
      <path
        d={`M${x + 19} ${y - 7} L${x + 28} ${y} L${x + 19} ${y + 7}`}
        stroke="url(#brand)"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </motion.g>
  );
}

const svgProps = {
  viewBox: "0 0 360 240",
  className: "h-full w-full",
  preserveAspectRatio: "xMidYMid meet",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

/* ── Demos ──────────────────────────────────────────────────────── */

function DemoMergePdf() {
  return (
    <svg {...svgProps}>
      <Defs />
      <motion.ellipse
        cx={180}
        cy={124}
        rx={92}
        ry={70}
        fill="url(#glow)"
        animate={{ opacity: [0.25, 0.5, 0.25], scale: [0.9, 1.06, 0.9] }}
        transition={loop(3.4)}
        style={{ transformOrigin: "180px 124px" }}
      />
      <motion.g animate={{ x: [-2, -2, 78, 78, -2], opacity: [1, 1, 1, 0, 1] }} transition={loop(3.4)}>
        <Doc x={64} y={74} label="PDF" lines={4} />
      </motion.g>
      <motion.g animate={{ x: [2, 2, -78, -78, 2], opacity: [1, 1, 1, 0, 1] }} transition={loop(3.4)}>
        <Doc x={218} y={74} label="PDF" lines={4} />
      </motion.g>
      <motion.g
        animate={{ opacity: [0, 0, 0, 1, 0], y: [12, 12, 12, 0, 12], scale: [0.9, 0.9, 0.9, 1, 0.9] }}
        transition={loop(3.4)}
        style={{ transformOrigin: "180px 128px" }}
      >
        <Doc x={140} y={70} w={84} h={112} label="PDF" lines={5} />
        <circle cx={216} cy={174} r={12} fill="url(#success)" />
        <path d="M210 174 l4 4 l8 -9" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <motion.g
        animate={{ opacity: [1, 1, 0, 0, 1], scale: [1, 1, 0.4, 0.4, 1] }}
        transition={loop(3.4)}
        style={{ transformOrigin: "180px 124px" }}
      >
        <circle cx={180} cy={124} r={15} fill="url(#brand)" filter="url(#soft)" />
        <path d="M180 116 v16 M172 124 h16" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

function DemoSplitPdf() {
  return (
    <svg {...svgProps}>
      <Defs />
      <motion.ellipse
        cx={132}
        cy={122}
        rx={86}
        ry={66}
        fill="url(#glow)"
        animate={{ opacity: [0.2, 0.4, 0.2], scale: [0.9, 1.05, 0.9] }}
        transition={loop(3.4)}
        style={{ transformOrigin: "132px 122px" }}
      />
      <motion.g animate={{ x: [0, -48, -48, 0] }} transition={loop(3.4)}>
        <Doc x={96} y={70} w={82} h={104} label="PDF" lines={5} />
      </motion.g>
      {[0, 1, 2].map((i) => (
        <motion.g
          key={i}
          animate={{
            x: [0, 80, 80, 0],
            y: [0, (i - 1) * 36, (i - 1) * 36, 0],
            rotate: [0, (i - 1) * 7, (i - 1) * 7, 0],
            opacity: [0, 1, 1, 0],
          }}
          transition={loop(3.4, 0.07 * i)}
          style={{ transformOrigin: "150px 124px" }}
        >
          <Page x={150} y={84} num={i + 1} />
        </motion.g>
      ))}
    </svg>
  );
}

function DemoCompressPdf() {
  return (
    <svg {...svgProps}>
      <Defs />
      <motion.ellipse
        cx={180}
        cy={120}
        rx={84}
        ry={64}
        fill="url(#glow)"
        animate={{ opacity: [0.2, 0.45, 0.2] }}
        transition={loop(3.2)}
        style={{ transformOrigin: "180px 120px" }}
      />
      <motion.g animate={{ x: [0, 24, 24, 0] }} transition={loop(3.2)}>
        <path d="M98 108 l-13 14 l13 14" stroke="url(#brand)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M116 110 l-12 12 l12 12" stroke="url(#brand)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.45} />
      </motion.g>
      <motion.g animate={{ x: [0, -24, -24, 0] }} transition={loop(3.2)}>
        <path d="M262 108 l13 14 l-13 14" stroke="url(#brand)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M244 110 l12 12 l-12 12" stroke="url(#brand)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.45} />
      </motion.g>
      <motion.g animate={{ scale: [1, 0.76, 0.76, 1] }} transition={loop(3.2)} style={{ transformOrigin: "180px 120px" }}>
        <Doc x={140} y={70} w={80} h={100} label="PDF" lines={5} />
      </motion.g>
      <motion.g animate={{ opacity: [1, 0, 0, 1] }} transition={loop(3.2)}>
        <rect x={150} y={186} width={60} height={22} rx={11} fill="#F1F5F9" stroke="#E2E8F0" />
        <text x={180} y={201} fontSize={11} fontWeight={700} fill="#64748B" textAnchor="middle" fontFamily="inherit">
          8.4 MB
        </text>
      </motion.g>
      <motion.g animate={{ opacity: [0, 1, 1, 0] }} transition={loop(3.2)}>
        <rect x={150} y={186} width={60} height={22} rx={11} fill="url(#success)" />
        <text x={180} y={201} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="inherit">
          1.2 MB
        </text>
      </motion.g>
    </svg>
  );
}

function DemoPdfToText() {
  return (
    <svg {...svgProps}>
      <Defs />
      <Doc x={44} y={68} w={80} h={106} label="PDF" lines={5} />
      <Arrow x={140} y={122} />
      <g filter="url(#soft)">
        <rect x={194} y={68} width={122} height={106} rx={12} fill="url(#page)" stroke="#E6EBF2" />
        <rect x={194} y={68} width={122} height={106} rx={12} fill="url(#sheen)" />
      </g>
      <text x={208} y={96} fontSize={17} fontWeight={800} fill="#2563EB" fontFamily="inherit">
        Aa
      </text>
      {[88, 96, 70, 84].map((w, i) => (
        <motion.rect
          key={i}
          x={208}
          y={108 + i * 13}
          width={w}
          height={5}
          rx={2.5}
          fill="#94A3B8"
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={loop(3.2, 0.25 + i * 0.22)}
        />
      ))}
    </svg>
  );
}

function DemoPdfToWord() {
  return (
    <svg {...svgProps}>
      <Defs />
      <motion.ellipse
        cx={180}
        cy={122}
        rx={92}
        ry={66}
        fill="url(#glow)"
        animate={{ opacity: [0.2, 0.42, 0.2] }}
        transition={loop(3.2)}
        style={{ transformOrigin: "180px 122px" }}
      />
      <motion.g
        animate={{ x: [0, 34, 34, 0], opacity: [1, 1, 0, 1], scale: [1, 0.9, 0.84, 1] }}
        transition={loop(3.2)}
        style={{ transformOrigin: "108px 122px" }}
      >
        <Doc x={68} y={70} w={80} h={104} grad="pdfG" label="PDF" lines={5} />
      </motion.g>
      <Arrow x={166} y={122} />
      <motion.g
        animate={{ x: [-34, 0, 0, -34], opacity: [0, 1, 1, 0], scale: [0.84, 0.9, 1, 0.84] }}
        transition={loop(3.2)}
        style={{ transformOrigin: "252px 122px" }}
      >
        <Doc x={212} y={70} w={80} h={104} grad="wordG" label="DOCX" lines={5} />
        <text x={252} y={150} fontSize={34} fontWeight={800} fill="#2563EB" opacity={0.12} textAnchor="middle" fontFamily="inherit">
          W
        </text>
      </motion.g>
    </svg>
  );
}

function DemoWordToPdf() {
  return (
    <svg {...svgProps}>
      <Defs />
      <motion.ellipse
        cx={180}
        cy={122}
        rx={92}
        ry={66}
        fill="url(#glow)"
        animate={{ opacity: [0.2, 0.42, 0.2] }}
        transition={loop(3.2)}
        style={{ transformOrigin: "180px 122px" }}
      />
      <motion.g
        animate={{ x: [0, 34, 34, 0], opacity: [1, 1, 0, 1], scale: [1, 0.9, 0.84, 1] }}
        transition={loop(3.2)}
        style={{ transformOrigin: "108px 122px" }}
      >
        <Doc x={68} y={70} w={80} h={104} grad="wordG" label="DOCX" lines={5} />
        <text x={108} y={150} fontSize={34} fontWeight={800} fill="#2563EB" opacity={0.12} textAnchor="middle" fontFamily="inherit">
          W
        </text>
      </motion.g>
      <Arrow x={166} y={122} />
      <motion.g
        animate={{ x: [-34, 0, 0, -34], opacity: [0, 1, 1, 0], scale: [0.84, 0.9, 1, 0.84] }}
        transition={loop(3.2)}
        style={{ transformOrigin: "252px 122px" }}
      >
        <Doc x={212} y={70} w={80} h={104} grad="pdfG" label="PDF" lines={5} />
      </motion.g>
    </svg>
  );
}

function DemoImageConverter() {
  return (
    <svg {...svgProps}>
      <Defs />
      <motion.g animate={{ y: [0, -6, 0] }} transition={loop(3.4)}>
        <g filter="url(#soft)">
          <rect x={106} y={56} width={148} height={114} rx={16} fill="url(#page)" stroke="#E6EBF2" />
          <clipPath id="imgclip">
            <rect x={112} y={62} width={136} height={88} rx={11} />
          </clipPath>
          <g clipPath="url(#imgclip)">
            <rect x={112} y={62} width={136} height={88} fill="url(#sky)" />
            <circle cx={148} cy={92} r={15} fill="url(#amber)" />
            <path d="M112 150 L150 108 L184 142 L214 100 L248 150 Z" fill="#34D399" />
            <path d="M112 150 L148 124 L182 150 Z" fill="#059669" opacity={0.85} />
            <motion.rect x={112} y={62} width={34} height={88} fill="url(#sheen)" animate={{ x: [-50, 150] }} transition={loop(2.8)} />
          </g>
          <rect x={112} y={156} width={64} height={5} rx={2.5} fill="#CBD5E1" />
          <rect x={182} y={156} width={28} height={5} rx={2.5} fill="#E2E8F0" />
        </g>
      </motion.g>
      <rect x={104} y={184} width={152} height={28} rx={14} fill="#F1F5F9" stroke="#E2E8F0" />
      <motion.rect
        y={187}
        height={22}
        width={46}
        rx={11}
        fill="url(#brand)"
        animate={{ x: [107, 107, 157, 157, 207, 207, 107] }}
        transition={loop(4.2)}
      />
      <motion.text x={130} y={202} fontSize={11} fontWeight={700} textAnchor="middle" fontFamily="inherit" animate={{ fill: ["#fff", "#fff", "#475569", "#475569", "#475569", "#475569", "#fff"] }} transition={loop(4.2)}>
        PNG
      </motion.text>
      <motion.text x={180} y={202} fontSize={11} fontWeight={700} textAnchor="middle" fontFamily="inherit" animate={{ fill: ["#475569", "#475569", "#fff", "#fff", "#475569", "#475569", "#475569"] }} transition={loop(4.2)}>
        JPG
      </motion.text>
      <motion.text x={230} y={202} fontSize={11} fontWeight={700} textAnchor="middle" fontFamily="inherit" animate={{ fill: ["#475569", "#475569", "#475569", "#475569", "#fff", "#fff", "#475569"] }} transition={loop(4.2)}>
        WEBP
      </motion.text>
    </svg>
  );
}

function DemoVideoConverter() {
  return (
    <svg {...svgProps}>
      <Defs />
      <motion.g animate={{ y: [0, -6, 0] }} transition={loop(3.4)}>
        <g filter="url(#soft)">
          <rect x={92} y={54} width={176} height={112} rx={16} fill="url(#brand)" />
          <rect x={92} y={54} width={176} height={112} rx={16} fill="#0B1220" opacity={0.22} />
          <rect x={92} y={54} width={176} height={112} rx={16} fill="url(#sheen)" />
          <circle cx={180} cy={104} r={25} fill="#FFFFFF" opacity={0.95} />
          <path d="M173 92 L194 104 L173 116 Z" fill="#2563EB" />
          <rect x={108} y={146} width={144} height={6} rx={3} fill="#FFFFFF" opacity={0.3} />
          <motion.rect x={108} y={146} height={6} rx={3} fill="#FFFFFF" animate={{ width: [6, 144, 144, 6] }} transition={loop(3.6)} />
        </g>
      </motion.g>
      <rect x={116} y={184} width={128} height={28} rx={14} fill="#F1F5F9" stroke="#E2E8F0" />
      <motion.rect y={187} height={22} width={60} rx={11} fill="url(#brand)" animate={{ x: [119, 119, 181, 181, 119] }} transition={loop(3.6)} />
      <motion.text x={149} y={202} fontSize={11} fontWeight={700} textAnchor="middle" fontFamily="inherit" animate={{ fill: ["#fff", "#fff", "#475569", "#475569", "#fff"] }} transition={loop(3.6)}>
        MP4
      </motion.text>
      <motion.text x={211} y={202} fontSize={11} fontWeight={700} textAnchor="middle" fontFamily="inherit" animate={{ fill: ["#475569", "#475569", "#fff", "#fff", "#475569"] }} transition={loop(3.6)}>
        WEBM
      </motion.text>
    </svg>
  );
}

const DEMOS: Record<string, ComponentType> = {
  "merge-pdf": DemoMergePdf,
  "split-pdf": DemoSplitPdf,
  "compress-pdf": DemoCompressPdf,
  "pdf-to-text": DemoPdfToText,
  "pdf-to-word": DemoPdfToWord,
  "word-to-pdf": DemoWordToPdf,
  "image-converter": DemoImageConverter,
  "video-converter": DemoVideoConverter,
};

/** Renders the looping demo for a tool slug, or nothing if there's none. */
export function ToolDemo({ slug }: { slug: string }) {
  const Demo = DEMOS[slug];
  return Demo ? <Demo /> : null;
}
