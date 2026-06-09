"use client";

import { useCallback, useRef, useState } from "react";
import { runTool } from "@/lib/api";
import type { Tool } from "@/lib/tools-registry";
import type { JobResult } from "@/lib/types";

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
    async (files: File[], options: Record<string, string | number | boolean>, token?: string) => {
      if (!tool) return;
      if (files.length === 0) {
        setState({ ...INITIAL, stage: "error", error: "Please add at least one file." });
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ stage: "uploading", progress: 0, result: null, error: null });

      try {
        const result = await runTool({
          endpoint: tool.endpoint,
          files,
          options,
          token,
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
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState(INITIAL);
        } else {
          setState({ stage: "error", progress: 0, result: null, error: (err as Error).message });
        }
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
