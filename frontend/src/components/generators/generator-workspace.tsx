"use client";

import dynamic from "next/dynamic";

function Placeholder() {
  return <div className="h-[640px] animate-pulse rounded-2xl border border-border bg-card shadow-card" />;
}

// Loaded as separate chunks so the regular tool pages (which share the same
// route) don't download the generator code.
const QrGenerator = dynamic(() => import("./qr-generator").then((m) => m.QrGenerator), {
  loading: Placeholder,
});
const BarcodeGenerator = dynamic(() => import("./barcode-generator").then((m) => m.BarcodeGenerator), {
  loading: Placeholder,
});

export function GeneratorWorkspace({ kind, slug }: { kind: "qr" | "barcode"; slug: string }) {
  return kind === "qr" ? <QrGenerator slug={slug} /> : <BarcodeGenerator slug={slug} />;
}
