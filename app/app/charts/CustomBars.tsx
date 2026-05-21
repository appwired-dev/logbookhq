/**
 * Infographic-style 3D arrow bars for Recharts.
 *
 *   ArrowBar3D            — vertical bar with arrow tip pointing UP (Hours per year).
 *   ArrowBar3DHorizontal  — horizontal bar with arrow tip pointing RIGHT (Hours per aircraft type).
 *
 * Both share:
 *   - All-blue gradient (light → mid → dark)
 *   - Pentagonal front face + isometric depth face
 *   - Hard-edged drop shadow in light slate-grey, offset to the lower-RIGHT so
 *     the shadow of bar N visually lands in the band of bar N+1.
 */

const BLUE_LITE = "#93c5fd";
const BLUE_MID = "#3b82f6";
const BLUE_DARK = "#1e40af";

// Shared shadow color — both charts use the same light slate grey.
const SHADOW_COLOR = "#94a3b8";
const SHADOW_OPACITY = 0.55;

/**
 * Colour palette for per-aircraft-type bars. Each slot has a light/mid/dark
 * triplet so the same gradient treatment can be applied without per-color math.
 * 10 distinct hues cycled by index — enough for typical pilot logbooks.
 */
export const COLORED_PALETTE = [
  { lite: "#93c5fd", mid: "#3b82f6", dark: "#1e40af" }, // blue
  { lite: "#6ee7b7", mid: "#10b981", dark: "#065f46" }, // emerald
  { lite: "#fcd34d", mid: "#f59e0b", dark: "#92400e" }, // amber
  { lite: "#c4b5fd", mid: "#8b5cf6", dark: "#5b21b6" }, // violet
  { lite: "#f9a8d4", mid: "#ec4899", dark: "#9d174d" }, // pink
  { lite: "#67e8f9", mid: "#06b6d4", dark: "#155e75" }, // cyan
  { lite: "#fdba74", mid: "#f97316", dark: "#9a3412" }, // orange
  { lite: "#bef264", mid: "#84cc16", dark: "#3f6212" }, // lime
  { lite: "#d8b4fe", mid: "#a855f7", dark: "#6b21a8" }, // purple
  { lite: "#5eead4", mid: "#14b8a6", dark: "#115e59" }, // teal
] as const;

export function paletteForIndex(i: number) {
  return COLORED_PALETTE[i % COLORED_PALETTE.length];
}

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  fill?: string;
  colored?: boolean;
}

/** Vertical 3D bar — grows upward, flat top. */
export function ArrowBar3D(props: ShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0 } = props;
  if (height <= 0 || width <= 0) return null;

  const depth = Math.min(width * 0.42, 11);
  const id = `varr-${Math.round(x)}-${Math.round(y)}-${Math.round(width)}`;

  // Shadow offset: push roughly one bar-width to the right so it falls into
  // the next year's column band, plus a small vertical drop.
  const shDx = Math.round(width * 0.85);
  const shDy = 6;

  // Front face: plain rectangle (no arrow tip).
  const front = [
    `M ${x},${y + height}`,
    `L ${x},${y}`,
    `L ${x + width},${y}`,
    `L ${x + width},${y + height}`,
    "Z",
  ].join(" ");

  // Right + top depth face — extruded back-up at an isometric angle.
  const side = [
    `M ${x + width},${y}`,
    `L ${x + width + depth},${y - depth}`,
    `L ${x + width + depth},${y + height - depth}`,
    `L ${x + width},${y + height}`,
    "Z",
  ].join(" ");
  const top = [
    `M ${x},${y}`,
    `L ${x + depth},${y - depth}`,
    `L ${x + width + depth},${y - depth}`,
    `L ${x + width},${y}`,
    "Z",
  ].join(" ");

  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BLUE_LITE} />
          <stop offset="50%" stopColor={BLUE_MID} />
          <stop offset="100%" stopColor={BLUE_DARK} />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="200%" height="200%">
          <feDropShadow
            dx={shDx}
            dy={shDy}
            stdDeviation="1.2"
            floodColor={SHADOW_COLOR}
            floodOpacity={SHADOW_OPACITY}
          />
        </filter>
      </defs>
      {/* Shadow group: draw the bar silhouette filtered to drop-shadow only.
          The fill is fully transparent so only the dropped shadow renders. */}
      <g filter={`url(#${id}-shadow)`}>
        <path d={front} fill="rgba(0,0,0,0.001)" />
      </g>
      <path d={side} fill={BLUE_DARK} opacity="0.82" />
      <path d={top} fill={BLUE_LITE} opacity="0.85" />
      <path d={front} fill={`url(#${id})`} />
      {/* Specular highlight along top-front edge */}
      <path d={`M ${x + 1.5},${y + 0.5} L ${x + width - 1.5},${y + 0.5}`} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" />
    </g>
  );
}

/** Horizontal 3D bar — grows rightward, flat right edge. */
export function ArrowBar3DHorizontal(props: ShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, colored = false } = props;
  if (height <= 0 || width <= 0) return null;

  // Pick gradient colors: per-index palette when `colored`, otherwise the
  // shared blue gradient.
  const pal = colored ? paletteForIndex(index) : { lite: BLUE_LITE, mid: BLUE_MID, dark: BLUE_DARK };

  const depth = Math.min(height * 0.42, 9);
  const id = `harr-${Math.round(x)}-${Math.round(y)}-${Math.round(width)}-${index}`;

  // Shadow offset: push down by roughly one bar-height so it lands in the
  // next aircraft-type's row band; same horizontal grey as vertical chart.
  const shDx = 6;
  const shDy = Math.round(height * 0.85);

  // Front face: plain rectangle (no arrow tip)
  const front = [
    `M ${x},${y}`,
    `L ${x + width},${y}`,
    `L ${x + width},${y + height}`,
    `L ${x},${y + height}`,
    "Z",
  ].join(" ");

  // Top face — extruded back-up at an isometric angle.
  const top = [
    `M ${x},${y}`,
    `L ${x + width},${y}`,
    `L ${x + width + depth},${y - depth}`,
    `L ${x + depth},${y - depth}`,
    "Z",
  ].join(" ");
  // Right side face — fills the wedge between the bar's right edge and its
  // extruded back-right corner. Without this the bar end looks hollow.
  const side = [
    `M ${x + width},${y}`,
    `L ${x + width + depth},${y - depth}`,
    `L ${x + width + depth},${y + height - depth}`,
    `L ${x + width},${y + height}`,
    "Z",
  ].join(" ");

  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pal.lite} />
          <stop offset="50%" stopColor={pal.mid} />
          <stop offset="100%" stopColor={pal.dark} />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="200%" height="200%">
          <feDropShadow
            dx={shDx}
            dy={shDy}
            stdDeviation="1.2"
            floodColor={SHADOW_COLOR}
            floodOpacity={SHADOW_OPACITY}
          />
        </filter>
      </defs>
      <g filter={`url(#${id}-shadow)`}>
        <path d={front} fill="rgba(0,0,0,0.001)" />
      </g>
      <path d={side} fill={pal.dark} opacity="0.82" />
      <path d={top} fill={pal.lite} opacity="0.85" />
      <path d={front} fill={`url(#${id})`} />
      {/* Specular highlight along top edge */}
      <path d={`M ${x + 0.5},${y + 0.5} L ${x + width - 1},${y + 0.5}`} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" />
    </g>
  );
}

/**
 * Recharts-compatible wrapper: same as ArrowBar3DHorizontal but cycles a
 * multi-colour palette by index. Used by "Hours per aircraft type" so each
 * aircraft gets its own hue while sharing the 3D arrow design.
 */
export function ArrowBar3DHorizontalColored(props: ShapeProps) {
  return <ArrowBar3DHorizontal {...props} colored />;
}

/** @deprecated — kept for backward compat. Use ArrowBar3DHorizontal instead. */
export const CylinderBar = ArrowBar3DHorizontal;
