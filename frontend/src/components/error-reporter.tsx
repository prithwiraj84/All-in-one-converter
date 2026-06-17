"use client";

import { useEffect } from "react";
import { API_BASE } from "@/lib/api";

/**
 * Reports uncaught client-side errors to the backend so they show up in the
 * admin panel's "Logs → frontend" view. Throttled + deduped to avoid spam; the
 * backend only buffers them when the admin panel is enabled. Renders nothing.
 */
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const seen = new Set<string>();

    function report(message: string, source?: string) {
      if (sent >= 10 || !message) return;
      const key = (source ?? "") + message;
      if (seen.has(key)) return;
      seen.add(key);
      sent += 1;
      try {
        fetch(`${API_BASE}/api/admin/client-error`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: message.slice(0, 1000), source, level: "error" }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* never let reporting break the page */
      }
    }

    const onError = (e: ErrorEvent) =>
      report(e.message || "Uncaught error", e.filename ? `${e.filename}:${e.lineno}` : undefined);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string } | string | undefined;
      report(typeof r === "string" ? r : r?.message || "Unhandled promise rejection", "promise");
    };

    // Also surface errors logged via console.error (React errors, handled catches).
    const origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      origError(...args);
      try {
        const msg = args
          .map((a) => (typeof a === "string" ? a : (a as { message?: string })?.message ?? String(a)))
          .join(" ");
        report(msg, "console.error");
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      console.error = origError;
    };
  }, []);

  return null;
}
