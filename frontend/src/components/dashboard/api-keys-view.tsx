"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, Copy, Trash2, Plus, Loader2, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKey,
  type NewApiKey,
} from "@/lib/business-api";

function fmtDate(s?: string | null): string {
  if (!s) return "never";
  return new Date(s).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function ApiKeysView() {
  const [keys, setKeys] = React.useState<ApiKey[] | null>(null);
  const [gated, setGated] = React.useState(false);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [fresh, setFresh] = React.useState<NewApiKey | null>(null);

  const load = React.useCallback(async () => {
    try {
      setKeys(await listApiKeys());
      setGated(false);
    } catch (e) {
      if ((e as Error).message.toLowerCase().includes("business")) setGated(true);
      setKeys([]);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    if (creating) return;
    setCreating(true);
    try {
      const key = await createApiKey(name.trim() || "API key");
      setFresh(key);
      setName("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this key? Apps using it will stop working immediately.")) return;
    try {
      await revokeApiKey(id);
      toast.success("Key revoked");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (gated) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">REST API</h1>
        <Card className="mt-6 p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 font-semibold">API access is a Business feature</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Generate API keys and automate conversions from your own apps and scripts on the Business plan.
          </p>
          <Button asChild variant="gradient" className="mt-5">
            <Link href="/#pricing">See Business plan</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">REST API</h1>
          <p className="mt-1.5 text-muted-foreground">
            Use these keys to call the converter from your own code. Keep them secret.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/api-docs" target="_blank">
            API docs <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Freshly created key — shown once */}
      {fresh && (
        <Card className="border-success/40 bg-success/5 p-5">
          <div className="flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="font-medium">
              Copy your key now — for your security it won&apos;t be shown again.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
              {fresh.key}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(fresh.key);
                toast.success("Copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
          <button className="mt-3 text-xs text-muted-foreground underline" onClick={() => setFresh(null)}>
            Done — hide it
          </button>
        </Card>
      )}

      {/* Create */}
      <Card>
        <CardHeader>
          <CardTitle>Generate a key</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <input
            className={inputCls}
            placeholder="Key name (e.g. Production server)"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
          />
          <Button variant="gradient" onClick={generate} disabled={creating} className="shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate key
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : keys.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No keys yet. Generate one above to start using the API.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{k.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {k.key_prefix} · last used {fmtDate(k.last_used_at)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 text-destructive" onClick={() => revoke(k.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
