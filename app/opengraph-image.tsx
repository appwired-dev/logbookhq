import { ImageResponse } from "next/og";

// Social-share preview image (1200×630) — what Twitter/LinkedIn/Reddit/Slack
// fetch when someone pastes a pilotlogbookhq.com link. Generated at build time
// from the JSX below.
export const alt = "Pilot Logbook HQ — multi-regime pilot logbook";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0c4a6e 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top — brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.4, display: "flex", gap: 8 }}>
            <span>Pilot Logbook</span>
            <span style={{ color: "#7dd3fc" }}>HQ</span>
          </div>
        </div>

        {/* Middle — main message */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 980 }}>
            The pilot logbook
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 980,
              background: "linear-gradient(90deg, #bae6fd, #ddd6fe)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            for every regime.
          </div>
          <div style={{ fontSize: 28, color: "#cbd5e1", marginTop: 28, maxWidth: 1000, lineHeight: 1.35 }}>
            CA · ICAO · FAA · EASA · UKCAA · GCAA · GACA · QCAA · HKCAD · CAAC
          </div>
        </div>

        {/* Bottom — pricing + URL */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 24, color: "#94a3b8" }}>
            $3/mo · $30/yr · $119 lifetime · 100 flights free
          </div>
          <div style={{ fontSize: 24, color: "#7dd3fc", fontWeight: 600 }}>
            pilotlogbookhq.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
