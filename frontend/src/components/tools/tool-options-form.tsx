"use client";

import type { ToolOption } from "@/lib/tools-registry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type OptionValues = Record<string, string | number | boolean>;

export function defaultOptionValues(options?: ToolOption[]): OptionValues {
  const values: OptionValues = {};
  for (const opt of options ?? []) {
    if (opt.type === "select") values[opt.name] = opt.default;
    else if (opt.type === "number") values[opt.name] = opt.default;
    else if (opt.type === "toggle") values[opt.name] = opt.default;
    else if (opt.type === "text") values[opt.name] = opt.default ?? "";
    else if (opt.type === "password") values[opt.name] = "";
  }
  return values;
}

interface ToolOptionsFormProps {
  options: ToolOption[];
  values: OptionValues;
  onChange: (values: OptionValues) => void;
  disabled?: boolean;
}

export function ToolOptionsForm({ options, values, onChange, disabled }: ToolOptionsFormProps) {
  const visible = options.filter((o) => !(o.type === "select" && o.hidden));
  if (visible.length === 0) return null;

  const set = (name: string, value: string | number | boolean) =>
    onChange({ ...values, [name]: value });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visible.map((opt) => (
        <div
          key={opt.name}
          className={opt.type === "toggle" ? "sm:col-span-2" : undefined}
        >
          {opt.type === "toggle" ? (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
              <input
                type="checkbox"
                checked={Boolean(values[opt.name])}
                onChange={(e) => set(opt.name, e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              />
              <span className="text-sm font-medium">{opt.label}</span>
            </label>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={opt.name}>{opt.label}</Label>
              {opt.type === "select" ? (
                <Select
                  id={opt.name}
                  value={String(values[opt.name] ?? opt.default)}
                  onChange={(e) => set(opt.name, e.target.value)}
                  disabled={disabled}
                >
                  {opt.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : opt.type === "number" ? (
                <Input
                  id={opt.name}
                  type="number"
                  min={opt.min}
                  max={opt.max}
                  step={opt.step}
                  value={String(values[opt.name] ?? opt.default)}
                  onChange={(e) => set(opt.name, e.target.value === "" ? "" : Number(e.target.value))}
                  disabled={disabled}
                />
              ) : (
                <Input
                  id={opt.name}
                  type={opt.type === "password" ? "password" : "text"}
                  placeholder={opt.placeholder}
                  value={String(values[opt.name] ?? "")}
                  onChange={(e) => set(opt.name, e.target.value)}
                  disabled={disabled}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
