/**
 * Shared domain types. These mirror the Supabase schema (supabase/schema.sql)
 * and the FastAPI response contracts (backend/app/schemas).
 */

export type UUID = string;
export type ISODate = string;

export type FileStatus = "uploaded" | "processing" | "ready" | "failed" | "deleted";
export type ConversionStatus = "queued" | "processing" | "completed" | "failed";
export type SubscriptionPlan = "free" | "pro" | "business";

export interface UserProfile {
  id: UUID;
  email: string;
  name: string | null;
  avatar_url: string | null;
  plan: SubscriptionPlan;
  created_at: ISODate;
}

export interface FileRecord {
  id: UUID;
  user_id: UUID;
  filename: string;
  size: number;
  type: string; // MIME type
  status: FileStatus;
  storage_path: string | null;
  created_at: ISODate;
  expires_at: ISODate | null;
}

export interface ConversionRecord {
  id: UUID;
  user_id: UUID;
  tool: string; // tool slug, e.g. "merge-pdf"
  source_file: string | null;
  output_file: string | null;
  status: ConversionStatus;
  error: string | null;
  created_at: ISODate;
  completed_at: ISODate | null;
}

export interface Subscription {
  id: UUID;
  user_id: UUID;
  plan: SubscriptionPlan;
  status: "active" | "canceled" | "trialing" | "past_due";
  current_period_end: ISODate | null;
  created_at: ISODate;
}

/** Standard envelope returned by the backend processing endpoints. */
export interface JobResult {
  job_id: string;
  tool: string;
  status: ConversionStatus;
  download_url?: string;
  output_filename?: string;
  output_size?: number;
  /** Multiple downloadable outputs (e.g. files extracted from an archive). */
  files?: { name: string; download_url: string; size: number }[];
  /** For OCR / text tools that return inline content. */
  text?: string;
  meta?: Record<string, unknown>;
  error?: string;
}

export interface ApiError {
  detail: string;
  code?: string;
  status?: number;
}

export type ToolCategory =
  | "pdf"
  | "document"
  | "image"
  | "ocr"
  | "archive"
  | "audio"
  | "video"
  | "font"
  | "ai";

export interface PricingTier {
  name: string;
  price: number;
  period: string;
  description: string;
  highlight?: boolean;
  cta: string;
  features: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface StatItem {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
}
