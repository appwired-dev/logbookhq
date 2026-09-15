import { ImageResponse } from "next/og";

// 512x512 brand logo for schema.org Organization.logo. The favicon (app/icon.tsx)
// is 32x32 — below Google's 112px minimum, so it's ignored for logo/knowledge-
// panel treatment. This route serves a proper large square version of the same
// mark. Prerendered at build.
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)",
          borderRadius: 104,
        }}
      >
        <svg width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
