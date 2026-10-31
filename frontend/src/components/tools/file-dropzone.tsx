"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { UploadCloud, File as FileIcon, X, GripVertical, FolderOpen } from "lucide-react";
import { cn, formatBytes, fileExt } from "@/lib/utils";
import { dropzoneAccept, formatLabels, joinFormats } from "@/lib/file-types";
import { Button } from "@/components/ui/button";

interface FileDropzoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  maxSizeMb?: number;
  disabled?: boolean;
}

/** Plain-language reason a file was refused (react-dropzone's own messages are technical). */
function rejectionMessage(rejections: readonly FileRejection[], formats: string, maxSizeMb: number): string | null {
  if (!rejections.length) return null;
  const { file, errors } = rejections[0];
  switch (errors[0]?.code) {
    case "file-too-large":
      return `“${file.name}” is ${formatBytes(file.size)} — files can be up to ${maxSizeMb} MB on your plan. Try a smaller file, or upgrade to Pro for files up to 1 GB.`;
    case "file-invalid-type":
      return `“${file.name}” isn't a ${formats} file. Please choose a ${formats} file for this tool.`;
    case "too-many-files":
      return "This tool works on one file at a time — please choose just one file.";
    default:
      return "That file couldn't be added. Please try another one.";
  }
}

/** Stable key for a File across reorders (name/size/lastModified don't change). */
function fileKey(f: File): string {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

function FileRow({
  file,
  draggable,
  onRemove,
}: {
  file: File;
  draggable: boolean;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={file}
      dragListener={false}
      dragControls={controls}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      {draggable && (
        <span
          onPointerDown={(e) => controls.start(e)}
          className="-m-2 shrink-0 cursor-grab touch-none p-2 text-muted-foreground/70 transition-colors hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          role="button"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
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
        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </Reorder.Item>
  );
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

  const formats = joinFormats(formatLabels(accept));
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: dropzoneAccept(accept),
    multiple,
    maxSize: maxSizeMb * 1024 * 1024,
    disabled,
  });
  const rejection = rejectionMessage(fileRejections, formats || "supported", maxSizeMb);
  const what = multiple ? "files" : "a file";
  const hasFiles = files.length > 0;

  // Reordering only matters when the tool takes several files (e.g. Merge PDF).
  const reorderable = multiple && files.length > 1;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex min-w-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 text-center transition-all sm:px-6",
          hasFiles ? "py-6" : "py-9 sm:py-12",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border bg-surface hover:border-primary/50 hover:bg-primary/[0.03]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input {...getInputProps()} />
        {!hasFiles && (
          <motion.div
            animate={{ y: isDragActive ? -6 : 0 }}
            className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient bg-[length:200%_200%] shadow-glow sm:h-16 sm:w-16"
          >
            <UploadCloud className="h-7 w-7 text-white" />
          </motion.div>
        )}
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">
            {isDragActive ? (
              "Drop it here"
            ) : hasFiles ? (
              multiple ? "Add more files" : "Choose a different file"
            ) : (
              <>
                {/* Touch screens can't drag & drop, so tell them to tap instead. */}
                <span className="[@media(hover:none)]:hidden">Drag &amp; drop {what} here</span>
                <span className="hidden [@media(hover:none)]:inline">Tap below to choose {what}</span>
              </>
            )}
          </p>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {formats && <span className="font-medium text-foreground/80">{formats}</span>}
            {formats && " · "}up to {maxSizeMb} MB{multiple ? " each" : ""}
          </p>
        </div>
        {/* A span (not a button): the whole box already opens the file picker. */}
        <span
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold transition-colors",
            hasFiles
              ? "border border-input bg-background text-foreground group-hover:bg-muted"
              : "bg-primary text-primary-foreground shadow-sm group-hover:bg-primary/90",
          )}
        >
          <FolderOpen className="h-4 w-4" />
          {hasFiles ? (multiple ? "Add files" : "Replace file") : multiple ? "Choose files" : "Choose file"}
        </span>
      </div>

      {rejection && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {rejection}
        </p>
      )}

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {reorderable && (
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <GripVertical className="h-3.5 w-3.5" /> Drag to set the order they&apos;re combined in
              </p>
            )}
            <Reorder.Group axis="y" values={files} onReorder={onChange} className="space-y-2">
              {files.map((file) => (
                <FileRow
                  key={fileKey(file)}
                  file={file}
                  draggable={reorderable}
                  onRemove={() => onChange(files.filter((f) => f !== file))}
                />
              ))}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
