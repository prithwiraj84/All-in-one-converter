"use client";

import { useCallback, useRef, useState } from "react";
import { runTool } from "@/lib/api";
import { isClientTool, runClientTool, type ClientFile } from "@/lib/client-tools";
import type { Tool } from "@/lib/tools-registry";
import type { JobResult } from "@/lib/types";

/** Build a JobResult-shaped envelope from in-browser outputs (blob: URLs). */
function clientResult(tool: Tool, outputs: ClientFile[]): JobResult {
  if (outputs.length === 1) {
    const f = outputs[0];
    return {
      job_id: "client",
      tool: tool.slug,
      status: "completed",
      client: true,
      download_url: URL.createObjectURL(f.blob),
      output_filename: f.filename,
      output_size: f.blob.size,
    };
  }
  return {
    job_id: "client",
    tool: tool.slug,
    status: "completed",
    client: true,
    files: outputs.map((f) => ({
      name: f.filename,
      download_url: URL.createObjectURL(f.blob),
      size: f.blob.size,
    })),
  };
}

export type RunnerStage = "idle" | "uploading" | "processing" | "done" | "error";

export interface RunnerState {
  stage: RunnerStage;
  progress: number;
  result: JobResult | null;
  error: string | null;
}

const INITIAL: RunnerState = { stage: "idle", progress: 0, result: null, error: null };

/**
 * Drives a single tool execution: tracks upload progress, processing,
 * the final JobResult, and error/abort handling. Used by ToolRunner.
 */
export function useToolRunner(tool: Tool | undefined) {
  const [state, setState] = useState<RunnerState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (
      files: File[],
      options: Record<string, string | number | boolean>,
      token?: string,
    ): Promise<JobResult | null> => {
      if (!tool) return null;
      if (files.length === 0) {
        setState({ ...INITIAL, stage: "error", error: "Please add at least one file." });
        return null;
      }
      const controller = new AbortController();
      abortRef.current = controller;

      // ── In-browser path: instant, private, no upload. Falls through to the
      // server if the browser can't handle this input/format (runClientTool
      // returns null on any unsupported case or failure).
      if (isClientTool(tool.slug)) {
        setState({ stage: "processing", progress: 100, result: null, error: null });
        const outputs = await runClientTool(tool.slug, files, options);
        if (outputs && outputs.length > 0) {
          const result = clientResult(tool, outputs);
          setState({ stage: "done", progress: 100, result, error: null });
          return result;
        }
        // else: fall back to the server below
      }

      setState({ stage: "uploading", progress: 0, result: null, error: null });

      try {
        const result = await runTool({
          endpoint: tool.endpoint,
          files,
          options,
          token,
          toolSlug: tool.slug,
          signal: controller.signal,
          onProgress: (percent) =>
            setState((s) => ({
              ...s,
              progress: percent,
              stage: percent >= 100 ? "processing" : "uploading",
            })),
        });

        if (result.status === "failed") {
          setState({ stage: "error", progress: 100, result, error: result.error ?? "Processing failed." });
        } else {
          setState({ stage: "done", progress: 100, result, error: null });
        }
        return result;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState(INITIAL);
        } else {
          setState({ stage: "error", progress: 0, result: null, error: (err as Error).message });
        }
        return null;
      }
    },
    [tool],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { state, run, cancel, reset };
}
