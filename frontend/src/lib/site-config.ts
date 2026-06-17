import type { FaqItem, PricingTier, StatItem } from "./types";

export const SITE = {
  name: "All in one converter",
  shortName: "AIO Converter",
  tagline: "All Your File Tools. One Powerful Platform.",
  description:
    "Convert, compress, edit, protect and optimize PDFs, images, videos, audio and documents using one intelligent platform. 100+ free file tools.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://all-in-one-converter.devprithwiraj.in",
  ogImage: "/og.png",
  twitter: "@aioconverter",
  // Public contact (used in the footer + legal pages). Swap for a domain alias
  // (e.g. support@your-domain) whenever you have one set up.
  email: "digital.toshiconsulting@gmail.com",
} as const;

/**
 * Social profiles (external links). ⚠️ Replace these with your REAL handles/URLs
 * — they power the footer's external + social links, which help SEO.
 */
export const SOCIAL = {
  twitter: "https://x.com/prithwirajdas84",
  github: "https://github.com/prithwiraj84/All-in-one-converter",
} as const;

export const NAV_LINKS = [
  { label: "Tools", href: "/tools" },
  { label: "Pricing", href: "/#pricing" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Security", href: "/#security" },
  { label: "FAQ", href: "/#faq" },
] as const;

export const HERO_STATS: StatItem[] = [
  { label: "Files Processed", value: 1_000_000, suffix: "+" },
  { label: "Powerful Tools", value: 100, suffix: "+" },
  { label: "Uptime", value: 99.9, suffix: "%" },
  { label: "Happy Users", value: 50_000, suffix: "+" },
];

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Upload",
    description: "Drag and drop your files or browse to select them. We support 100+ formats.",
    icon: "upload",
  },
  {
    step: 2,
    title: "Process",
    description: "Choose your options and let our optimized engine do the heavy lifting in seconds.",
    icon: "cpu",
  },
  {
    step: 3,
    title: "Download",
    description: "Grab your converted file instantly. We delete it automatically afterwards.",
    icon: "download",
  },
] as const;

export const SECURITY_FEATURES = [
  {
    title: "Automatic File Deletion",
    description: "Every uploaded and processed file is permanently deleted within 60 minutes.",
    icon: "trash",
  },
  {
    title: "Encrypted Transfers",
    description: "All uploads and downloads are protected with TLS 1.3 end-to-end encryption.",
    icon: "lock",
  },
  {
    title: "Secure Storage",
    description: "Files are stored in isolated, access-controlled buckets — never shared or indexed.",
    icon: "shield",
  },
  {
    title: "Privacy First",
    description: "We never sell your data or train models on your files. Your documents stay yours.",
    icon: "eye-off",
  },
] as const;

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: 0,
    period: "forever",
    description: "Everything you need for everyday file tasks.",
    cta: "Start Free",
    features: [
      "Access to all 100+ tools",
      "Files up to 100 MB",
      "5 tasks per day",
      "Standard processing speed",
      "Automatic file deletion",
    ],
  },
  {
    name: "Pro",
    price: 99,
    period: "month",
    description: "For professionals who convert files every day.",
    highlight: true,
    cta: "Upgrade to Pro",
    features: [
      "Everything in Free",
      "Files up to 2 GB",
      "Unlimited tasks",
      "Priority processing queue",
      "Batch processing",
      "No ads, ever",
    ],
  },
  {
    name: "Business",
    price: 499,
    period: "month",
    description: "For teams that need scale, control and an API.",
    cta: "Contact Sales",
    features: [
      "Everything in Pro",
      "Files up to 10 GB",
      "Team workspaces & roles",
      "REST API access",
      "Custom retention policies",
      "Priority support & SLA",
    ],
  },
];

export const FAQS: FaqItem[] = [
  {
    question: "Is All in one converter really free?",
    answer:
      "Yes. Every one of our 100+ tools is free to use with generous daily limits. Pro and Business plans unlock larger files, unlimited tasks, batch processing and an API.",
  },
  {
    question: "Are my files safe and private?",
    answer:
      "Absolutely. Files are transferred over encrypted TLS connections, stored in isolated buckets, and automatically deleted within 60 minutes of processing. We never share, sell or index your files.",
  },
  {
    question: "Do I need to install any software?",
    answer:
      "No installation required. Everything runs in your browser and on our secure cloud. Just upload, process and download from any device.",
  },
  {
    question: "What file formats do you support?",
    answer:
      "We support 100+ formats across PDF, Word, Excel, PowerPoint, images (JPG, PNG, WebP, GIF, TIFF), audio (MP3, WAV, FLAC), video (MP4, WebM, MOV) and archives (ZIP, TAR).",
  },
  {
    question: "Is there a file size limit?",
    answer:
      "Free users can process files up to 100 MB. Pro raises this to 2 GB and Business up to 10 GB per file.",
  },
  {
    question: "Can I use this on mobile?",
    answer:
      "Yes. The platform is fully responsive and mobile-first, so every tool works beautifully on phones and tablets as well as desktop.",
  },
];

export const FOOTER_SECTIONS = [
  {
    title: "PDF Tools",
    links: [
      { label: "Merge PDF", href: "/merge-pdf" },
      { label: "Split PDF", href: "/split-pdf" },
      { label: "Compress PDF", href: "/compress-pdf" },
      { label: "PDF to Word", href: "/pdf-to-word" },
    ],
  },
  {
    title: "Convert",
    links: [
      { label: "Word to PDF", href: "/word-to-pdf" },
      { label: "Image Converter", href: "/image-converter" },
      { label: "Video Converter", href: "/video-converter" },
      { label: "Audio Converter", href: "/audio-converter" },
    ],
  },
  {
    title: "Product",
    links: [
      { label: "All Tools", href: "/tools" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Sign up", href: "/signup" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#how-it-works" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Contact", href: "mailto:prithwirajdas84@gmail.com" },
    ],
  },
] as const;
