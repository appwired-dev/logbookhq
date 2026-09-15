import type { MetadataRoute } from "next";

// Lists the public routes Google should crawl + index. Private routes (/app,
// /api, /share/[token]) are excluded — those are either auth-gated or
// per-user secret links.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://pilotlogbookhq.com";
  // Stable, per-page lastmod (content-change dates), NOT build time — a bulk
  // "everything changed on every deploy" signal trains crawlers to ignore lastmod.
  return [
    { url: base,                                     lastModified: "2026-09-14", changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/pricing`,                         lastModified: "2026-09-14", changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/signup`,                          lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.7 },
    // Content / SEO landing pages (multi-regime wedge + comparison intent).
    { url: `${base}/multi-regime-pilot-logbook`,     lastModified: "2026-09-13", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/foreflight-logbook-alternative`, lastModified: "2026-09-13", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/logten-pro-alternative`,          lastModified: "2026-09-13", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/transport-canada-pilot-logbook`, lastModified: "2026-09-13", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/myflightbook-alternative`,       lastModified: "2026-09-14", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/easa-pilot-logbook`,             lastModified: "2026-09-14", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/faa-easa-logbook`,               lastModified: "2026-09-14", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/terms`,                           lastModified: "2026-05-19", changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/privacy`,                         lastModified: "2026-05-19", changeFrequency: "yearly",  priority: 0.3 },
  ];
}
