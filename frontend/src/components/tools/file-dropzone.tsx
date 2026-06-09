"use client";

import { useCallback } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, File as FileIcon, X } from "lucide-react";
import { cn, formatBytes, fileExt } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileDropzoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  maxSizeMb?: number;
  disabled?: boolean;
}

function toAccept(mimes?: string[]): Accept | undefined {
  if (!mimes || mimes.length === 0) return undefined;
  return Object.fromEntries(mimes.map((m) => [m, [] as string[]]));
}

export function FileDropzone({
  files,
  onChange,
  accept,
  multiple = false,
  maxSizeMb = 100,
  disabled,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return;
      onChange(multiple ? [...files, ...accepted] : [accepted[0]]);
    },
    [files, multiple, onChange],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: toAccept(accept),
    multiple,
    maxSize: maxSizeMb * 1024 * 1024,
    disabled,
  });

  const removeFile = (index: number) => onChange(files.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border bg-surface hover:border-primary/50 hover:bg-primary/[0.03]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={{ y: isDragActive ? -6 : 0 }}
          className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient bg-[length:200%_200%] shadow-glow"
        >
          <UploadCloud className="h-7 w-7 text-white" />
        </motion.div>
        <div>
          <p className="text-base font-semibold text-foreground">
            {isDragActive ? "Drop your files here" : "Drag & drop files here"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or <span className="font-medium text-primary">browse</span> — up to {maxSizeMb} MB
            {multiple ? " each" : ""}
          </p>
        </div>
        {accept && accept.length > 0 && (
          <p className="text-xs text-muted-foreground/70">
            Accepted: {accept.map((a) => a.split("/")[1]?.toUpperCase() || a).join(", ")}
          </p>
        )}
      </div>

      {fileRejections.length > 0 && (
        <p className="text-sm text-destructive">
          {fileRejections[0].errors[0]?.message ?? "Some files were rejected."}
        </p>
      )}

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map((file, i) => (
              <motion.li
                key={`${file.name}-${i}`}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fileExt(file.name).toUpperCase()} · {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
