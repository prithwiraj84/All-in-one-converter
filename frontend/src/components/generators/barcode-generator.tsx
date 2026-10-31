"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Barcode, ClipboardCopy, Download, FileArchive, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { RenderOptions } from "bwip-js/browser";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSessionState } from "@/hooks/use-session-state";
import {
  ALL_FORMATS_GROUP,
  BARCODE_FORMATS,
  barcodeErrorMessage,
  formatFromSymbol,
  type BarcodeFormat,
} from "@/lib/generators/barcode-formats";
import { blobBytes, contrastRatio, copyImage, csvCell, luminance, saveBlob, slugify, zipFiles } from "@/lib/generators/shared";
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

type Bwip = typeof import("bwip-js/browser");

let bwipLib: Promise<Bwip> | null = null;

/** bwip-js is large, so it's loaded on demand in the browser (and once). */
function loadBwip(): Promise<Bwip> {
  bwipLib ??= import("bwip-js/browser").catch((err) => {
    bwipLib = null;
    throw err;
  });
  return bwipLib;
}

const MAX_BATCH = 500;

type Mode = "single" | "batch";
type FileType = "png" | "jpg" | "svg";

interface BarcodeState {
  mode: Mode;
  bcid: string;
  text: string;
  batch: string;
  /** Pixels per module (bar width). */
  scale: number;
  /** Bar height in millimetres (1D only). */
  height: number;
  includetext: boolean;
  textsize: number;
  textyalign: "below" | "above";
  textxalign: "center" | "left" | "right" | "justify";
  alttext: string;
  barColor: string;
  textColor: string;
  bgColor: string;
  transparent: boolean;
  rotate: "N" | "R" | "I" | "L";
  padding: number;
  /** Export resolution multiplier on top of `scale`. */
  exportScale: number;
}

const INITIAL: BarcodeState = {
  mode: "single",
  bcid: "code128",
  text: "AIO-12345",
  batch: "",
  scale: 3,
  height: 15,
  includetext: true,
  textsize: 10,
  textyalign: "below",
  textxalign: "center",
  alttext: "",
  barColor: "#000000",
  textColor: "#000000",
  bgColor: "#ffffff",
  transparent: false,
  rotate: "N",
  padding: 10,
  exportScale: 2,
};

const CURATED_GROUPS = [...new Set(BARCODE_FORMATS.map((f) => f.group))];
const CURATED_IDS = new Set(BARCODE_FORMATS.map((f) => f.bcid));

const hex = (c: string) => c.replace("#", "");

function renderOptions(s: BarcodeState, fmt: BarcodeFormat, text: string, scaleMult = 1): RenderOptions {
  const o: RenderOptions & Record<string, unknown> = {
    ...fmt.opts,
    bcid: fmt.bcid,
    text,
    scale: s.scale * scaleMult,
    rotate: s.rotate,
    padding: s.padding,
    barcolor: hex(s.barColor),
  };
  if (!s.transparent) o.backgroundcolor = hex(s.bgColor);
  if (!fmt.twoD) {
    o.height = s.height;
    o.includetext = s.includetext;
    if (s.includetext) {
      o.textsize = s.textsize;
      o.textyalign = s.textyalign;
      o.textxalign = s.textxalign;
      o.textcolor = hex(s.textColor);
      if (s.alttext.trim()) o.alttext = s.alttext.trim();
    }
  }
  return o;
}

function barcodeWarnings(s: BarcodeState): string[] {
  const bg = s.transparent ? "#ffffff" : s.bgColor;
  if (luminance(s.barColor) > luminance(bg)) {
    return ["Light bars on a dark background can't be read by most scanners — use dark bars on a light background."];
  }
  if (contrastRatio(s.barColor, bg) < 3) return ["Low contrast between the bars and the background — it may not scan."];
  return s.transparent ? ["Transparent background: print or place the barcode on a light surface."] : [];
}

export function BarcodeGenerator({ slug }: { slug: string }) {
  const [state, setState] = useSessionState<BarcodeState>("aio:barcode-generator", INITIAL);
  const [lib, setLib] = useState<Bwip | null>(null);
  const [libError, setLibError] = useState(false);
  const [allFormats, setAllFormats] = useState<BarcodeFormat[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState<FileType | "copy" | null>(null);
  const [batchType, setBatchType] = useState<FileType>("png");
  const [progress, setProgress] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const set = (patch: Partial<BarcodeState>) => setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    let alive = true;
    loadBwip()
      .then((mod) => {
        if (!alive) return;
        setLib(mod);
        setAllFormats(
          mod.symbolList
            .filter((sym) => !CURATED_IDS.has(sym.bcid))
            .map(formatFromSymbol)
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      })
      .catch(() => alive && setLibError(true));
    return () => {
      alive = false;
    };
  }, []);

  const findFormat = (bcid: string) =>
    BARCODE_FORMATS.find((f) => f.bcid === bcid) ?? allFormats.find((f) => f.bcid === bcid) ?? null;
  const fmt = findFormat(state.bcid);

  const batchLines = useMemo(
    () => state.batch.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    [state.batch],
  );
  const previewText = state.mode === "batch" ? (batchLines[0] ?? "") : state.text.trim();

  // Live preview straight onto the canvas (bwip-js renders synchronously).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!lib || !fmt || !canvas) return;
    if (!previewText) {
      setRenderError(null);
      setDims(null);
      return;
    }
    try {
      lib.toCanvas(canvas, renderOptions(state, fmt, previewText));
      setRenderError(null);
      setDims({ w: canvas.width * state.exportScale, h: canvas.height * state.exportScale });
    } catch (err) {
      setRenderError(barcodeErrorMessage(err));
      setDims(null);
    }
  }, [lib, fmt, previewText, state]);

  function selectFormat(bcid: string) {
    const next = findFormat(bcid);
    setState((s) => {
      // Keep what the user typed; swap in the new sample only for empty/sample text.
      const keep = s.text.trim() && s.text !== findFormat(s.bcid)?.sample;
      return { ...s, bcid, text: keep ? s.text : (next?.sample ?? s.text) };
    });
  }

  async function makeFile(text: string, type: FileType): Promise<Blob> {
    if (!lib || !fmt) throw new Error("The barcode engine is still loading.");
    if (type === "svg") {
      return new Blob([lib.toSVG(renderOptions(state, fmt, text))], { type: "image/svg+xml" });
    }
    let canvas = document.createElement("canvas");
    lib.toCanvas(canvas, renderOptions(state, fmt, text, state.exportScale));
    if (type === "jpg") {
      // JPEG has no transparency — flatten onto the background color.
      const flat = document.createElement("canvas");
      flat.width = canvas.width;
      flat.height = canvas.height;
      const ctx = flat.getContext("2d")!;
      ctx.fillStyle = state.transparent ? "#ffffff" : state.bgColor;
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(canvas, 0, 0);
      canvas = flat;
    }
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Couldn't export the image."))),
        type === "jpg" ? "image/jpeg" : "image/png",
        0.95,
      ),
    );
  }

  async function download(type: FileType) {
    setBusy(type);
    try {
      saveBlob(await makeFile(previewText, type), `barcode-${state.bcid}-${slugify(previewText, 24)}.${type}`);
    } catch (err) {
      toast.error(barcodeErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    setBusy("copy");
    try {
      await copyImage(await makeFile(previewText, "png"));
      toast.success("Barcode copied — paste it anywhere");
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
      const csv = ["index,file,value,status"];
      for (let i = 0; i < lines.length; i++) {
        const name = `${String(i + 1).padStart(3, "0")}-${slugify(lines[i])}.${batchType}`;
        try {
          files.push({ name, data: await blobBytes(await makeFile(lines[i], batchType)) });
          csv.push([String(i + 1), name, lines[i], "ok"].map(csvCell).join(","));
        } catch (err) {
          csv.push([String(i + 1), "", lines[i], barcodeErrorMessage(err)].map(csvCell).join(","));
        }
        setProgress(Math.round(((i + 1) / lines.length) * 100));
        if (i % 25 === 24) await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive
      }
      files.push({ name: "index.csv", data: new TextEncoder().encode(csv.join("\n")) });
      const made = files.length - 1;
      saveBlob(await zipFiles(files), `barcodes-${state.bcid}-${made}.zip`);
      if (made < lines.length) toast.warning(`${made} barcodes created, ${lines.length - made} skipped — see index.csv`);
      else toast.success(`${made} barcodes downloaded`);
    } catch {
      toast.error("Couldn't build the ZIP file. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  const canExport = Boolean(lib && fmt && previewText) && !renderError;
  const oneD = fmt ? !fmt.twoD : true;
  const warnings = barcodeWarnings(state);

  const content = (
    <>
      <Segmented
        className="w-full"
        value={state.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "single", label: "One barcode", icon: Barcode },
          { value: "batch", label: "Many at once", icon: Layers },
        ]}
      />

      <section className="space-y-4">
        <Step
          n={1}
          title={state.mode === "single" ? "Pick a barcode type and enter the value" : "Pick a barcode type and paste your values"}
          hint="Not sure which type? Code 128 works for most labels; EAN-13 is for retail products."
        />
        <div className="space-y-1.5">
          <Label htmlFor="bc-format">Barcode type</Label>
          <Select id="bc-format" value={state.bcid} onChange={(e) => selectFormat(e.target.value)}>
            {CURATED_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {BARCODE_FORMATS.filter((f) => f.group === group).map((f) => (
                  <option key={f.bcid} value={f.bcid}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label={allFormats.length ? `${ALL_FORMATS_GROUP} (${allFormats.length})` : ALL_FORMATS_GROUP}>
              {allFormats.length ? (
                allFormats.map((f) => (
                  <option key={f.bcid} value={f.bcid}>
                    {f.label}
                  </option>
                ))
              ) : (
                <option disabled value="">
                  Loading more formats…
                </option>
              )}
            </optgroup>
          </Select>
          {fmt && <p className="text-xs text-muted-foreground">{fmt.hint}</p>}
        </div>

        {state.mode === "single" ? (
          <div className="space-y-1.5">
            <Label htmlFor="bc-text">Barcode value</Label>
            <Input
              id="bc-text"
              value={state.text}
              onChange={(e) => set({ text: e.target.value })}
              placeholder={fmt?.sample}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="bc-batch">Values — one per line</Label>
            <Textarea
              id="bc-batch"
              value={state.batch}
              onChange={(e) => set({ batch: e.target.value })}
              placeholder={fmt ? `${fmt.sample}\n…` : ""}
              className="min-h-[180px] font-mono text-base sm:text-xs"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              {batchLines.length} value{batchLines.length === 1 ? "" : "s"} · each line becomes its own barcode (up to{" "}
              {MAX_BATCH}) using the type and design you choose. Invalid lines are skipped and listed in index.csv.
            </p>
            {batchLines.length > MAX_BATCH && <Notice>Only the first {MAX_BATCH} lines will be generated.</Notice>}
          </div>
        )}
      </section>
    </>
  );

  const designControls = (
    <>
      <Step n={3} title="Customize the look (optional)" hint="Size, text and colors — the defaults print and scan well." />
      <Accordion type="multiple" className="rounded-xl border border-border px-4">
        <OptionGroup value="size" title="Size & text">
          <RangeField id="bc-scale" label="Bar thickness" min={1} max={8} value={state.scale} onChange={(scale) => set({ scale })} />
          {oneD ? (
            <>
              <RangeField id="bc-height" label="Bar height" min={5} max={60} value={state.height} format={(v) => `${v} mm`} onChange={(height) => set({ height })} />
              <ToggleField label="Show the number / text under the barcode" checked={state.includetext} onChange={(includetext) => set({ includetext })} />
              {state.includetext && (
                <>
                  <RangeField id="bc-textsize" label="Text size" min={6} max={24} value={state.textsize} format={(v) => `${v} pt`} onChange={(textsize) => set({ textsize })} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      id="bc-text-y"
                      label="Text position"
                      value={state.textyalign}
                      onChange={(v) => set({ textyalign: v as BarcodeState["textyalign"] })}
                      options={[
                        { label: "Below the bars", value: "below" },
                        { label: "Above the bars", value: "above" },
                      ]}
                    />
                    <SelectField
                      id="bc-text-x"
                      label="Text alignment"
                      value={state.textxalign}
                      onChange={(v) => set({ textxalign: v as BarcodeState["textxalign"] })}
                      options={[
                        { label: "Center", value: "center" },
                        { label: "Left", value: "left" },
                        { label: "Right", value: "right" },
                        { label: "Justify", value: "justify" },
                      ]}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bc-alttext">Custom text (optional)</Label>
                    <Input
                      id="bc-alttext"
                      value={state.alttext}
                      onChange={(e) => set({ alttext: e.target.value })}
                      placeholder="Shown instead of the encoded value"
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <Notice tone="info">2D codes scale evenly — bar height and text options don&apos;t apply.</Notice>
          )}
        </OptionGroup>

        <OptionGroup value="colors" title="Colors">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField id="bc-bar" label="Bar color" value={state.barColor} onChange={(barColor) => set({ barColor })} />
            <ColorField id="bc-bg" label="Background" value={state.bgColor} onChange={(bgColor) => set({ bgColor })} disabled={state.transparent} />
            {oneD && state.includetext && (
              <ColorField id="bc-textcolor" label="Text color" value={state.textColor} onChange={(textColor) => set({ textColor })} />
            )}
          </div>
          <ToggleField
            label="Transparent background"
            hint="PNG and SVG keep the transparency; JPG uses the background color."
            checked={state.transparent}
            onChange={(transparent) => set({ transparent })}
          />
        </OptionGroup>

        <OptionGroup value="layout" title="Layout">
          <SelectField
            id="bc-rotate"
            label="Rotation"
            value={state.rotate}
            onChange={(v) => set({ rotate: v as BarcodeState["rotate"] })}
            options={[
              { label: "0° (normal)", value: "N" },
              { label: "90° clockwise", value: "R" },
              { label: "180°", value: "I" },
              { label: "90° counter-clockwise", value: "L" },
            ]}
          />
          <RangeField id="bc-padding" label="White space around the barcode" min={0} max={40} value={state.padding} onChange={(padding) => set({ padding })} />
          <button
            type="button"
            onClick={() => setState((s) => ({ ...INITIAL, mode: s.mode, bcid: s.bcid, text: s.text, batch: s.batch }))}
            className="text-xs font-medium text-primary hover:underline"
          >
            Reset design to default
          </button>
        </OptionGroup>
      </Accordion>
    </>
  );

  const preview = (
    <>
      <Step n={2} title="Preview & download" hint="Updates as you type." />
      <PreviewStage transparent={state.transparent}>
        <canvas ref={canvasRef} className={cn("h-auto max-h-[360px] max-w-full", !canExport && "hidden")} />
        {!canExport && (
          <div className="px-6 text-center text-sm text-muted-foreground">
            {libError ? (
              "Couldn't load the barcode engine. Check your connection and reload the page."
            ) : !lib || !fmt ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin opacity-50" />
            ) : (
              <>
                <Barcode className="mx-auto mb-2 h-10 w-10 opacity-30" />
                {renderError
                  ? "This value isn't valid for the selected barcode type."
                  : state.mode === "batch"
                    ? "Add values to preview the first barcode."
                    : "Enter a value to see your barcode."}
              </>
            )}
          </div>
        )}
      </PreviewStage>
      {canExport && dims && (
        <p className="text-center text-xs text-muted-foreground">
          {state.mode === "batch" ? `Preview of value 1 of ${Math.min(batchLines.length, MAX_BATCH)} · ` : ""}
          Export {dims.w} × {dims.h} px · ≈ {((dims.w / 300) * 25.4).toFixed(0)} × {((dims.h / 300) * 25.4).toFixed(0)} mm at 300 DPI
        </p>
      )}
      {renderError && <Notice tone="error">{renderError}</Notice>}
      {warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}

      <DownloadArea slug={slug}>
        <div className="space-y-3">
          <SelectField
            id="bc-export-scale"
            label="Image resolution"
            value={String(state.exportScale)}
            onChange={(v) => set({ exportScale: Number(v) })}
            options={[
              { label: "Standard (1×)", value: "1" },
              { label: "High (2×)", value: "2" },
              { label: "Print (3×)", value: "3" },
              { label: "Large print (4×)", value: "4" },
            ]}
          />
          {state.mode === "single" ? (
            <>
              <Button variant="gradient" size="lg" className="w-full" onClick={() => download("png")} disabled={!canExport || busy !== null}>
                {busy === "png" ? <Loader2 className="animate-spin" /> : <Download />} Download PNG
              </Button>
              <div className="grid grid-cols-2 gap-2">
                {(["svg", "jpg"] as const).map((type) => (
                  <Button key={type} variant="outline" onClick={() => download(type)} disabled={!canExport || busy !== null}>
                    {busy === type && <Loader2 className="animate-spin" />}
                    {type.toUpperCase()}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="w-full" onClick={copy} disabled={!canExport || busy !== null}>
                {busy === "copy" ? <Loader2 className="animate-spin" /> : <ClipboardCopy />} Copy image
              </Button>
              <p className="text-center text-xs text-muted-foreground">Tip: SVG stays sharp at any size — best for print and labels.</p>
            </>
          ) : (
            <>
              <SelectField
                id="bc-batch-format"
                label="File format"
                value={batchType}
                onChange={(v) => setBatchType(v as FileType)}
                options={[
                  { label: "PNG images", value: "png" },
                  { label: "SVG (vector)", value: "svg" },
                  { label: "JPG images", value: "jpg" },
                ]}
              />
              <Button variant="gradient" size="lg" className="w-full" onClick={downloadZip} disabled={!canExport || progress !== null}>
                {progress !== null ? <Loader2 className="animate-spin" /> : <FileArchive />}
                Download ZIP ({Math.min(batchLines.length, MAX_BATCH)} barcodes)
              </Button>
              {progress !== null && (
                <div className="space-y-1">
                  <Progress value={progress} />
                  <p className="text-center text-xs text-muted-foreground">Generating… {progress}%</p>
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">Includes an index.csv listing every file and value.</p>
            </>
          )}
        </div>
      </DownloadArea>
    </>
  );

  return (
    <GeneratorShell
      icon={Barcode}
      title="Barcode Generator"
      description="Choose a barcode type, enter the value, customize — then download."
      content={content}
      design={designControls}
      preview={preview}
    />
  );
}
