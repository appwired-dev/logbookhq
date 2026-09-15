/**
 * Shared OpenGraph fields for marketing routes.
 *
 * Next merges metadata field-by-field, so any route that exports its own
 * `openGraph` object REPLACES the layout's wholesale — silently dropping
 * siteName/type/locale and the social share image. Every marketing page
 * exports its own openGraph, so those pages shipped with no share image and no
 * site attribution. Spread OG_BASE into each page's openGraph to restore them
 * while keeping the page's own title/description/url. Twitter cards then derive
 * from these (twitter.card is set site-wide in app/layout.tsx).
 */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Pilot Logbook HQ — multi-regime pilot logbook",
};

export const OG_BASE = {
  siteName: "Pilot Logbook HQ",
  type: "website" as const,
  locale: "en_US",
  images: [OG_IMAGE],
};
