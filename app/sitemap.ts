import type { MetadataRoute } from "next";

// Lists the public routes Google should crawl + index. Private routes (/app,
// /api, /share/[token]) are excluded — those are either auth-gated or
// per-user secret links.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://pilotlogbookhq.com";
  const now = new Date();
  return [
    { url: `${base}/`,        lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/signup`,  lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/login`,   lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
