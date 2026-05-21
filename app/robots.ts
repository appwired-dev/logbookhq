import type { MetadataRoute } from "next";

// Tells crawlers what's fair game. The signed-in app (/app/**) and API
// (/api/**) are not for search engines. The per-user share routes
// (/share/[token]) shouldn't be indexed either — they're unguessable but
// not secret; explicit disallow keeps them out of search if a URL leaks.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/api/", "/share/"],
      },
    ],
    sitemap: "https://pilotlogbookhq.com/sitemap.xml",
    host: "https://pilotlogbookhq.com",
  };
}
