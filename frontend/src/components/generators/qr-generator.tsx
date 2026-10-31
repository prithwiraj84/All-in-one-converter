"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, Download, FileArchive, ImagePlus, Layers, Loader2, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type QRCodeStylingType from "qr-code-styling";
import type { FileExtension } from "qr-code-styling";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSessionState } from "@/hooks/use-session-state";
import { QR_TYPES, QR_TYPES_BY_KEY, type QrField, type QrType, type QrValues } from "@/lib/generators/qr-content";
import { DEFAULT_QR_DESIGN, QR_PRESETS, qrStylingOptions, qrWarnings, type QrDesign } from "@/lib/generators/qr-design";
import { blobBytes, copyImage, csvCell, readAsDataURL, saveBlob, slugify, zipFiles } from "@/lib/generators/shared";
import { cn } from "@/lib/utils";
import {
  ColorField,
  DownloadArea,
  GeneratorShell,
  Notice,
  OptionGroup,
  PreviewStage,
  RangeField,
  Segmented,
  SelectField,
  Step,
  ToggleField,
} from "./generator-ui";

type QRCodeStylingCtor = typeof QRCodeStylingType;

let qrLib: Promise<QRCodeStylingCtor> | null = null;

/** qr-code-styling needs the DOM, so it's loaded in the browser only (and once). */
function loadQrLib(): Promise<QRCodeStylingCtor> {
  qrLib ??= import("qr-code-styling")
    .then((m) => m.default)
    .catch((err) => {
      qrLib = null;
      throw err;
    });
  return qrLib;
}

function qrErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return /overflow/i.test(msg)
    ? "Too much content for a QR code — shorten it or lower the error correction level."
    : "Couldn't create this QR code. Please check the content and try again.";
}

const PREVIEW_SIZE = 300;
const MAX_BATCH = 500;

type Mode = "single" | "batch";

interface QrState {
  mode: Mode;
  type: QrType;
  values: Partial<Record<QrType, QrValues>>;
  batch: string;
  design: QrDesign;
}

const INITIAL: QrState = { mode: "single", type: "url", values: {}, batch: "", design: DEFAULT_QR_DESIGN };

const DOT_OPTIONS = [
  { label: "Square", value: "square" },
  { label: "Rounded", value: "rounded" },
  { label: "Extra rounded", value: "extra-rounded" },
  { label: "Dots", value: "dots" },
  { label: "Classy", value: "classy" },
  { label: "Classy rounded", value: "classy-rounded" },
];

const CORNER_SQUARE_OPTIONS = [
  { label: "Square", value: "square" },
  { label: "Rounded", value: "extra-rounded" },
  { label: "Circle", value: "dot" },
  { label: "Classy", value: "classy" },
  { label: "Classy rounded", value: "classy-rounded" },
  { label: "Dotted", value: "dots" },
];

const CORNER_DOT_OPTIONS = [
  { label: "Square", value: "square" },
  { label: "Circle", value: "dot" },
  { label: "Rounded", value: "rounded" },
  { label: "Extra rounded", value: "extra-rounded" },
  { label: "Classy", value: "classy" },
  { label: "Classy rounded", value: "classy-rounded" },
];

const ECL_OPTIONS = [
  { label: "Low (7%) — smallest code", value: "L" },
  { label: "Medium (15%) — recommended", value: "M" },
  { label: "Quartile (25%)", value: "Q" },
  { label: "High (30%) — best with a logo", value: "H" },
];

const SIZE_OPTIONS = [
  { label: "512 × 512 px — web", value: "512" },
  { label: "1024 × 1024 px — documents", value: "1024" },
  { label: "2048 × 2048 px — print", value: "2048" },
  { label: "4096 × 4096 px — large print", value: "4096" },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

function ContentField({
  field,
  value,
  onChange,
}: {
  field: QrField;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `qr-field-${field.name}`;
  return (
    <div className={cn("space-y-1.5", !field.half && "sm:col-span-2")}>
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea id={id} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className="min-h-[90px]" />
      ) : field.type === "select" ? (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type ?? "text"}
          value={value}
          placeholder={field.placeholder}
          step={field.type === "number" ? "any" : undefined}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      )}
    </div>
  );
}

export function QrGenerator({ slug }: { slug: string }) {
  const [state, setState] = useSessionState<QrState>("aio:qr-generator", INITIAL);
  const { design } = state;
  const def = QR_TYPES_BY_KEY[state.type] ?? QR_TYPES[0];
  const values = state.values[def.key] ?? def.defaults ?? {};

  const batchLines = useMemo(
    () => state.batch.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    [state.batch],
  );
  const data = state.mode === "batch" ? (batchLines[0] ?? "") : def.build(values);

  const previewRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [busy, setBusy] = useState<FileExtension | "copy" | null>(null);
  const [batchExt, setBatchExt] = useState<"png" | "svg">("png");
  const [progress, setProgress] = useState<number | null>(null);

  const setDesign = (patch: Partial<QrDesign>) =>
    setState((s) => ({ ...s, design: { ...s.design, ...patch } }));

  const setValue = (name: string, value: string) =>
    setState((s) => ({
      ...s,
      values: { ...s.values, [def.key]: { ...(s.values[def.key] ?? def.defaults ?? {}), [name]: value } },
    }));

  // Live preview — rebuilt (debounced) whenever the content or design changes.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    if (!data) {
      el.innerHTML = "";
      setRenderError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const QRCodeStyling = await loadQrLib();
        if (cancelled) return;
        const qr = new QRCodeStyling({ ...qrStylingOptions(design, data, PREVIEW_SIZE), type: "svg" });
        el.innerHTML = "";
        qr.append(el);
        setRenderError(null);
      } catch (err) {
        if (cancelled) return;
        el.innerHTML = "";
        setRenderError(qrErrorMessage(err));
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data, design]);

  async function renderBlob(content: string, ext: FileExtension): Promise<Blob> {
    const QRCodeStyling = await loadQrLib();
    const qr = new QRCodeStyling({
      ...qrStylingOptions(design, content, design.size, { opaque: ext === "jpeg" }),
      type: ext === "svg" ? "svg" : "canvas",
    });
    const raw = await qr.getRawData(ext);
    if (!(raw instanceof Blob)) throw new Error("Couldn't render the QR code.");
    return raw;
  }

  async function download(ext: FileExtension) {
    setBusy(ext);
    try {
      const blob = await renderBlob(data, ext);
      saveBlob(blob, `qr-${def.key}-${slugify(data, 24)}.${ext === "jpeg" ? "jpg" : ext}`);
    } catch (err) {
      toast.error(qrErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    setBusy("copy");
    try {
      await copyImage(await renderBlob(data, "png"));
      toast.success("QR code copied — paste it anywhere");
    } catch (err) {
      toast.error(err instanceof Error && /support/.test(err.message) ? err.message : "Couldn't copy the image.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadZip() {
    const lines = batchLines.slice(0, MAX_BATCH);
    setProgress(0);
    try {
      const files: { name: string; data: Uint8Array }[] = [];
      const csv = ["index,file,content,status"];
      for (let i = 0; i < lines.length; i++) {
        const name = `${String(i + 1).padStart(3, "0")}-${slugify(lines[i])}.${batchExt}`;
        try {
          files.push({ name, data: await blobBytes(await renderBlob(lines[i], batchExt)) });
          csv.push([String(i + 1), name, lines[i], "ok"].map(csvCell).join(","));
        } catch (err) {
          csv.push([String(i + 1), "", lines[i], qrErrorMessage(err)].map(csvCell).join(","));
        }
        setProgress(Math.round(((i + 1) / lines.length) * 100));
      }
      files.push({ name: "index.csv", data: new TextEncoder().encode(csv.join("\n")) });
      saveBlob(await zipFiles(files), `qr-codes-${files.length - 1}.zip`);
      const skipped = lines.length - (files.length - 1);
      if (skipped) toast.warning(`${files.length - 1} QR codes created, ${skipped} skipped — see index.csv`);
      else toast.success(`${lines.length} QR codes downloaded`);
    } catch {
      toast.error("Couldn't build the ZIP file. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  async function onLogo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image file.");
    if (file.size > 1024 * 1024) return void toast.error("The logo must be under 1 MB.");
    try {
      // A logo covers part of the code, so switch to the strongest error correction.
      setDesign({ logo: await readAsDataURL(file), ecl: "H" });
    } catch {
      toast.error("Couldn't read that image.");
    }
  }

  const canExport = Boolean(data) && !renderError;
  const warnings = qrWarnings(design);

  const content = (
    <>
      <Segmented
        className="w-full"
        value={state.mode}
        onChange={(mode) => setState((s) => ({ ...s, mode }))}
        options={[
          { value: "single", label: "One QR code", icon: QrCode },
          { value: "batch", label: "Many at once", icon: Layers },
        ]}
      />

      {state.mode === "single" ? (
        <section className="space-y-4">
          <Step n={1} title="Choose what the QR code should open" hint="Pick a type, then fill in the details." />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {QR_TYPES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setState((s) => ({ ...s, type: key }))}
                aria-pressed={def.key === key}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-all",
                  def.key === key
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {def.fields.map((field) => (
              <ContentField
                key={`${def.key}.${field.name}`}
                field={field}
                value={values[field.name] ?? ""}
                onChange={(v) => setValue(field.name, v)}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-2">
          <Step n={1} title="Paste your items" hint="One link or text per line — each line becomes its own QR code." />
          <Label htmlFor="qr-batch" className="sr-only">Items — one per line</Label>
          <Textarea
            id="qr-batch"
            value={state.batch}
            onChange={(e) => setState((s) => ({ ...s, batch: e.target.value }))}
            placeholder={"https://example.com/product/1\nhttps://example.com/product/2\nTICKET-0003"}
            className="min-h-[180px] font-mono text-base sm:text-xs"
          />
          <p className="text-xs text-muted-foreground">
            {batchLines.length} item{batchLines.length === 1 ? "" : "s"} · each line becomes its own QR code (up to{" "}
            {MAX_BATCH}), encoded exactly as written. The design below applies to all of them.
          </p>
          {batchLines.length > MAX_BATCH && (
            <Notice>Only the first {MAX_BATCH} lines will be generated.</Notice>
          )}
        </section>
      )}
    </>
  );

  const designControls = (
    <>
      <Step n={3} title="Customize the look (optional)" hint="Colors, shapes and your logo — the default design scans great too." />
      <Accordion type="multiple" className="rounded-xl border border-border px-4">
        <OptionGroup value="style" title="Style & colors">
          <div className="flex flex-wrap gap-2">
            {QR_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setDesign(p.design)}
                className="min-h-9 rounded-full border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField id="qr-fg" label={design.gradient ? "Gradient start" : "Code color"} value={design.fg} onChange={(fg) => setDesign({ fg })} />
            <ColorField id="qr-bg" label="Background" value={design.bg} onChange={(bg) => setDesign({ bg })} disabled={design.transparent} />
          </div>
          <ToggleField
            label="Transparent background"
            hint="PNG, SVG and WebP keep the transparency; JPG uses the background color."
            checked={design.transparent}
            onChange={(transparent) => setDesign({ transparent })}
          />
          <ToggleField label="Gradient" checked={design.gradient} onChange={(gradient) => setDesign({ gradient })} />
          {design.gradient && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField id="qr-fg2" label="Gradient end" value={design.fg2} onChange={(fg2) => setDesign({ fg2 })} />
              <SelectField
                id="qr-gradient-type"
                label="Gradient type"
                value={design.gradientType}
                onChange={(v) => setDesign({ gradientType: v as QrDesign["gradientType"] })}
                options={[
                  { label: "Linear", value: "linear" },
                  { label: "Radial", value: "radial" },
                ]}
              />
              {design.gradientType === "linear" && (
                <div className="sm:col-span-2">
                  <RangeField id="qr-rotation" label="Angle" min={0} max={360} value={design.rotation} format={(v) => `${v}°`} onChange={(rotation) => setDesign({ rotation })} />
                </div>
              )}
            </div>
          )}
          <ToggleField
            label="Different color for the corner squares"
            hint="Color the three big corner squares separately."
            checked={design.customEyes}
            onChange={(customEyes) => setDesign({ customEyes })}
          />
          {design.customEyes && (
            <ColorField id="qr-eye" label="Corner square color" value={design.eyeColor} onChange={(eyeColor) => setDesign({ eyeColor })} />
          )}
        </OptionGroup>

        <OptionGroup value="shape" title="Shape">
          <SelectField id="qr-dots" label="Dot style" value={design.dotType} options={DOT_OPTIONS} onChange={(v) => setDesign({ dotType: v as QrDesign["dotType"] })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="qr-corner-square" label="Corner frame" value={design.cornerSquareType} options={CORNER_SQUARE_OPTIONS} onChange={(v) => setDesign({ cornerSquareType: v as QrDesign["cornerSquareType"] })} />
            <SelectField id="qr-corner-dot" label="Corner center" value={design.cornerDotType} options={CORNER_DOT_OPTIONS} onChange={(v) => setDesign({ cornerDotType: v as QrDesign["cornerDotType"] })} />
          </div>
          <div className="space-y-1.5">
            <Label>Overall shape</Label>
            <Segmented
              className="w-full"
              value={design.shape}
              onChange={(shape) => setDesign({ shape })}
              options={[
                { value: "square", label: "Square" },
                { value: "circle", label: "Circle" },
              ]}
            />
          </div>
        </OptionGroup>

        <OptionGroup value="logo" title="Logo">
          {design.logo ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL preview */}
              <img src={design.logo} alt="Your logo" className="h-12 w-12 rounded-md bg-white object-contain" />
              <p className="flex-1 text-sm font-medium">Logo added</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDesign({ logo: null })}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-surface px-4 py-6 text-center transition-colors hover:border-primary/50">
              <ImagePlus className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Upload a logo</span>
              <span className="text-xs text-muted-foreground">PNG, JPG, SVG or WebP · up to 1 MB</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  void onLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <RangeField id="qr-logo-size" label="Logo size" min={0.1} max={0.5} step={0.01} value={design.logoSize} format={pct} disabled={!design.logo} onChange={(logoSize) => setDesign({ logoSize })} />
          <RangeField id="qr-logo-margin" label="Space around logo" min={0} max={20} value={design.logoMargin} format={(v) => `${v}px`} disabled={!design.logo} onChange={(logoMargin) => setDesign({ logoMargin })} />
          <ToggleField
            label="Clear the dots behind the logo"
            checked={design.hideDots}
            onChange={(hideDots) => setDesign({ hideDots })}
          />
        </OptionGroup>

        <OptionGroup value="advanced" title="Advanced">
          <SelectField id="qr-ecl" label="Damage tolerance (error correction)" value={design.ecl} options={ECL_OPTIONS} onChange={(v) => setDesign({ ecl: v as QrDesign["ecl"] })} />
          <p className="-mt-2 text-xs text-muted-foreground">Higher keeps the code scannable even if part of it is covered or scratched.</p>
          <RangeField id="qr-quiet" label="White border around the code" min={0} max={15} value={design.quietZone} format={(v) => `${v}%`} onChange={(quietZone) => setDesign({ quietZone })} />
          <RangeField id="qr-round" label="Rounded background corners" min={0} max={50} value={design.bgRound} format={(v) => `${v}%`} onChange={(bgRound) => setDesign({ bgRound })} />
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, design: { ...DEFAULT_QR_DESIGN, size: s.design.size } }))}
            className="text-xs font-medium text-primary hover:underline"
          >
            Reset design to default
          </button>
          {data && (
            <details className="rounded-lg border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium">Encoded content ({data.length} characters)</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">{data}</pre>
            </details>
          )}
        </OptionGroup>
      </Accordion>
    </>
  );

  const preview = (
    <>
      <Step n={2} title="Preview & download" hint="Updates as you type." />
      <PreviewStage transparent={design.transparent}>
        <div ref={previewRef} className={cn("w-full max-w-[300px] [&>svg]:h-auto [&>svg]:w-full", !canExport && "hidden")} />
        {!canExport && (
          <div className="px-6 text-center text-sm text-muted-foreground">
            <QrCode className="mx-auto mb-2 h-10 w-10 opacity-30" />
            {renderError
              ? "This content can't fit in a QR code."
              : state.mode === "batch"
                ? "Add items to preview the first code."
                : "Fill in the required fields (*) to see your QR code."}
          </div>
        )}
      </PreviewStage>
      {canExport && (
        <p className="text-center text-xs text-muted-foreground">
          {state.mode === "batch" ? `Preview of item 1 of ${Math.min(batchLines.length, MAX_BATCH)} · ` : ""}
          Static code — works forever, no tracking
        </p>
      )}
      {renderError && <Notice tone="error">{renderError}</Notice>}
      {warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}

      <DownloadArea slug={slug}>
        <div className="space-y-3">
          <SelectField id="qr-size" label="Image size" value={String(design.size)} options={SIZE_OPTIONS} onChange={(v) => setDesign({ size: Number(v) })} />
          {state.mode === "single" ? (
            <>
              <Button variant="gradient" size="lg" className="w-full" onClick={() => download("png")} disabled={!canExport || busy !== null}>
                {busy === "png" ? <Loader2 className="animate-spin" /> : <Download />} Download PNG
              </Button>
              <div className="grid grid-cols-3 gap-2">
                {(["svg", "jpeg", "webp"] as const).map((ext) => (
                  <Button key={ext} variant="outline" onClick={() => download(ext)} disabled={!canExport || busy !== null}>
                    {busy === ext && <Loader2 className="animate-spin" />}
                    {ext === "jpeg" ? "JPG" : ext.toUpperCase()}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="w-full" onClick={copy} disabled={!canExport || busy !== null}>
                {busy === "copy" ? <Loader2 className="animate-spin" /> : <ClipboardCopy />} Copy image
              </Button>
              <p className="text-center text-xs text-muted-foreground">Tip: SVG stays sharp at any size — best for print.</p>
            </>
          ) : (
            <>
              <SelectField
                id="qr-batch-format"
                label="File format"
                value={batchExt}
                onChange={(v) => setBatchExt(v as "png" | "svg")}
                options={[
                  { label: "PNG images", value: "png" },
                  { label: "SVG (vector)", value: "svg" },
                ]}
              />
              <Button variant="gradient" size="lg" className="w-full" onClick={downloadZip} disabled={!canExport || progress !== null}>
                {progress !== null ? <Loader2 className="animate-spin" /> : <FileArchive />}
                Download ZIP ({Math.min(batchLines.length, MAX_BATCH)} codes)
              </Button>
              {progress !== null && (
                <div className="space-y-1">
                  <Progress value={progress} />
                  <p className="text-center text-xs text-muted-foreground">Generating… {progress}%</p>
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">Includes an index.csv listing every file and its content.</p>
            </>
          )}
        </div>
      </DownloadArea>
    </>
  );

  return (
    <GeneratorShell
      icon={QrCode}
      title="QR Code Generator"
      description="Pick a type, add your content, style it — then download."
      content={content}
      design={designControls}
      preview={preview}
    />
  );
}
