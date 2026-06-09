import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-config";
import { ALL_TOOL_SLUGS } from "@/lib/tools-registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE.url,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE.url}/tools`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE.url}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const toolRoutes: MetadataRoute.Sitemap = ALL_TOOL_SLUGS.map((slug) => ({
    url: `${SITE.url}/${slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...toolRoutes];
}
