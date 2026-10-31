import {
  CalendarDays,
  Contact,
  IndianRupee,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Type,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { SITE } from "@/lib/site-config";

/* ─────────────────────────────────────────────────────────────
   QR content types. Each turns a few form fields into the payload a
   phone camera understands (a URL, WIFI:…, BEGIN:VCARD, upi://pay …).
   ───────────────────────────────────────────────────────────── */

export type QrType =
  | "url"
  | "text"
  | "wifi"
  | "upi"
  | "whatsapp"
  | "email"
  | "phone"
  | "sms"
  | "vcard"
  | "event"
  | "location";

export type QrValues = Record<string, string>;

export interface QrField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "datetime-local" | "email" | "tel" | "url" | "number" | "password";
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  /** Render at half width (pairs up into a two-column row). */
  half?: boolean;
}

export interface QrTypeDef {
  key: QrType;
  label: string;
  icon: LucideIcon;
  fields: QrField[];
  defaults?: QrValues;
  /** Payload to encode, or "" while required fields are missing or invalid. */
  build: (v: QrValues) => string;
}

const enc = encodeURIComponent;
const val = (v: QrValues, k: string) => (v[k] ?? "").trim();
const digits = (s: string) => s.replace(/\D/g, "");
const phoneChars = (s: string) => s.replace(/[^\d+]/g, "");

/** Escape `\ ; , " :` for the WIFI: format. */
const wifiEscape = (s: string) => s.replace(/([\\;,":])/g, "\\$1");

/** Escape a text value for vCard / iCalendar. */
const textEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Local Date → "20261031T143000" (iCalendar floating local time). */
function icsStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/** "?a=1&b=2" from the non-empty pairs, or "". */
function query(pairs: [string, string][]): string {
  const parts = pairs.filter(([, v]) => v).map(([k, v]) => `${k}=${enc(v)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const QR_TYPES: QrTypeDef[] = [
  {
    key: "url",
    label: "Website",
    icon: Link2,
    fields: [{ name: "url", label: "Website URL", type: "url", placeholder: "https://example.com", required: true }],
    defaults: { url: SITE.url },
    build: (v) => {
      const url = val(v, "url");
      if (!url) return "";
      return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    },
  },
  {
    key: "text",
    label: "Text",
    icon: Type,
    fields: [{ name: "text", label: "Text", type: "textarea", placeholder: "Any text, code or note", required: true }],
    build: (v) => v.text ?? "",
  },
  {
    key: "wifi",
    label: "Wi-Fi",
    icon: Wifi,
    fields: [
      { name: "ssid", label: "Network name (SSID)", placeholder: "MyHomeWiFi", required: true },
      { name: "password", label: "Password", type: "password", placeholder: "Wi-Fi password" },
      {
        name: "encryption",
        label: "Security",
        type: "select",
        half: true,
        options: [
          { label: "WPA / WPA2 / WPA3", value: "WPA" },
          { label: "WEP", value: "WEP" },
          { label: "None (open)", value: "nopass" },
        ],
      },
      {
        name: "hidden",
        label: "Hidden network",
        type: "select",
        half: true,
        options: [
          { label: "No", value: "false" },
          { label: "Yes", value: "true" },
        ],
      },
    ],
    defaults: { encryption: "WPA", hidden: "false" },
    build: (v) => {
      const ssid = val(v, "ssid");
      const security = v.encryption || "WPA";
      const password = v.password ?? "";
      if (!ssid || (security !== "nopass" && !password)) return "";
      const pass = security === "nopass" ? "" : `P:${wifiEscape(password)};`;
      const hidden = v.hidden === "true" ? "H:true;" : "";
      return `WIFI:T:${security};S:${wifiEscape(ssid)};${pass}${hidden};`;
    },
  },
  {
    key: "upi",
    label: "UPI Payment",
    icon: IndianRupee,
    fields: [
      { name: "vpa", label: "UPI ID", placeholder: "yourname@okhdfcbank", required: true },
      { name: "name", label: "Payee name", placeholder: "Shop or person name" },
      { name: "amount", label: "Amount (₹, optional)", type: "number", placeholder: "Leave empty to let the payer choose", half: true },
      { name: "note", label: "Note (optional)", placeholder: "Order #1024", half: true },
    ],
    build: (v) => {
      const vpa = val(v, "vpa");
      if (!/^[\w.-]{2,}@[a-zA-Z][\w.-]*$/.test(vpa)) return "";
      const amount = Number(val(v, "amount"));
      const parts = [`pa=${vpa}`];
      if (val(v, "name")) parts.push(`pn=${enc(val(v, "name"))}`);
      if (amount > 0) parts.push(`am=${amount.toFixed(2)}`);
      parts.push("cu=INR");
      if (val(v, "note")) parts.push(`tn=${enc(val(v, "note"))}`);
      return `upi://pay?${parts.join("&")}`;
    },
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    fields: [
      { name: "phone", label: "Phone number (with country code)", type: "tel", placeholder: "+91 98765 43210", required: true },
      { name: "message", label: "Pre-filled message", type: "textarea", placeholder: "Hi! I'd like to know more…" },
    ],
    build: (v) => {
      const phone = digits(val(v, "phone"));
      if (phone.length < 8) return "";
      return `https://wa.me/${phone}${query([["text", v.message ?? ""]])}`;
    },
  },
  {
    key: "email",
    label: "Email",
    icon: Mail,
    fields: [
      { name: "to", label: "Email address", type: "email", placeholder: "hello@example.com", required: true },
      { name: "subject", label: "Subject", placeholder: "Hello" },
      { name: "body", label: "Message", type: "textarea", placeholder: "Your message" },
    ],
    build: (v) => {
      const to = val(v, "to");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return "";
      return `mailto:${to}${query([["subject", val(v, "subject")], ["body", v.body ?? ""]])}`;
    },
  },
  {
    key: "phone",
    label: "Phone",
    icon: Phone,
    fields: [{ name: "phone", label: "Phone number", type: "tel", placeholder: "+91 98765 43210", required: true }],
    build: (v) => {
      const phone = phoneChars(val(v, "phone"));
      return digits(phone).length >= 3 ? `tel:${phone}` : "";
    },
  },
  {
    key: "sms",
    label: "SMS",
    icon: MessageSquare,
    fields: [
      { name: "phone", label: "Phone number", type: "tel", placeholder: "+91 98765 43210", required: true },
      { name: "message", label: "Message", type: "textarea", placeholder: "Your message" },
    ],
    build: (v) => {
      const phone = phoneChars(val(v, "phone"));
      return digits(phone).length >= 3 ? `SMSTO:${phone}:${v.message ?? ""}` : "";
    },
  },
  {
    key: "vcard",
    label: "Contact",
    icon: Contact,
    fields: [
      { name: "firstName", label: "First name", half: true, required: true },
      { name: "lastName", label: "Last name", half: true },
      { name: "mobile", label: "Mobile", type: "tel", half: true },
      { name: "email", label: "Email", type: "email", half: true },
      { name: "org", label: "Company", half: true },
      { name: "title", label: "Job title", half: true },
      { name: "website", label: "Website", type: "url", placeholder: "https://example.com" },
      { name: "street", label: "Street address" },
      { name: "city", label: "City", half: true },
      { name: "state", label: "State", half: true },
      { name: "zip", label: "PIN / ZIP code", half: true },
      { name: "country", label: "Country", half: true },
      { name: "note", label: "Note", type: "textarea" },
    ],
    build: (v) => {
      const [first, last, org] = [val(v, "firstName"), val(v, "lastName"), val(v, "org")];
      const fullName = [first, last].filter(Boolean).join(" ") || org;
      if (!fullName) return "";
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${textEscape(last)};${textEscape(first)};;;`, `FN:${textEscape(fullName)}`];
      if (org) lines.push(`ORG:${textEscape(org)}`);
      if (val(v, "title")) lines.push(`TITLE:${textEscape(val(v, "title"))}`);
      if (val(v, "mobile")) lines.push(`TEL;TYPE=CELL:${phoneChars(val(v, "mobile"))}`);
      if (val(v, "email")) lines.push(`EMAIL:${val(v, "email")}`);
      if (val(v, "website")) lines.push(`URL:${val(v, "website")}`);
      const adr = ["street", "city", "state", "zip", "country"].map((k) => textEscape(val(v, k)));
      if (adr.some(Boolean)) lines.push(`ADR;TYPE=WORK:;;${adr.join(";")}`);
      if (val(v, "note")) lines.push(`NOTE:${textEscape(val(v, "note"))}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    },
  },
  {
    key: "event",
    label: "Event",
    icon: CalendarDays,
    fields: [
      { name: "title", label: "Event title", placeholder: "Product launch", required: true },
      { name: "location", label: "Location", placeholder: "Venue or meeting link" },
      { name: "start", label: "Starts", type: "datetime-local", half: true, required: true },
      { name: "end", label: "Ends", type: "datetime-local", half: true },
      { name: "description", label: "Description", type: "textarea" },
    ],
    build: (v) => {
      const title = val(v, "title");
      const start = new Date(val(v, "start"));
      if (!title || Number.isNaN(start.getTime())) return "";
      const endRaw = new Date(val(v, "end"));
      // Default to a one-hour event when no (valid) end is given.
      const end = Number.isNaN(endRaw.getTime()) || endRaw <= start ? new Date(start.getTime() + 3_600_000) : endRaw;
      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `SUMMARY:${textEscape(title)}`];
      if (val(v, "location")) lines.push(`LOCATION:${textEscape(val(v, "location"))}`);
      lines.push(`DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`);
      if (val(v, "description")) lines.push(`DESCRIPTION:${textEscape(val(v, "description"))}`);
      lines.push("END:VEVENT", "END:VCALENDAR");
      return lines.join("\n");
    },
  },
  {
    key: "location",
    label: "Location",
    icon: MapPin,
    fields: [
      { name: "address", label: "Address or place", placeholder: "Gateway of India, Mumbai" },
      { name: "lat", label: "Latitude (optional)", type: "number", placeholder: "18.9220", half: true },
      { name: "lng", label: "Longitude (optional)", type: "number", placeholder: "72.8347", half: true },
    ],
    build: (v) => {
      const [lat, lng] = [val(v, "lat"), val(v, "lng")];
      const coords = lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)) ? `${lat},${lng}` : "";
      const q = coords || val(v, "address");
      return q ? `https://www.google.com/maps/search/?api=1&query=${enc(q)}` : "";
    },
  },
];

export const QR_TYPES_BY_KEY = Object.fromEntries(QR_TYPES.map((t) => [t.key, t])) as Record<QrType, QrTypeDef>;
