/**
 * A click-to-play video for campaign pages (e.g. the TC Exam Prep "Logbook
 * Sunday" clips). It never autoplays — there is no `autoplay` attribute at all,
 * so it can't start with sound — and `preload="metadata"` fetches only the file
 * header until the visitor presses play. The frame is sized from the encoded
 * dimensions so a vertical social cut (9:16) holds its space while loading.
 * Plain server-rendered markup: no client JS.
 */
export type CampaignVideoSource = {
  /** Under /public, e.g. "/media/logbook-sunday-1.mp4". */
  src: string;
  /** Encoded frame size in pixels. */
  width: number;
  height: number;
  /** Accessible name, also shown as the caption line. */
  title: string;
  poster?: string;
  /** English WebVTT captions — needed unless the captions are burned into the video. */
  captions?: string;
};

const MIME: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

export function CampaignVideo({ video }: { video: CampaignVideoSource }) {
  const portrait = video.height > video.width;
  const type = MIME[video.src.split(".").pop()?.toLowerCase() ?? ""];
  return (
    <figure className="lp-panel lp-panel-glow p-2 sm:p-3 mx-auto w-full" style={{ maxWidth: portrait ? 340 : undefined }}>
      <video
        className="block w-full h-auto rounded-xl"
        style={{ aspectRatio: `${video.width} / ${video.height}`, background: "#000" }}
        width={video.width}
        height={video.height}
        controls
        playsInline
        preload="metadata"
        poster={video.poster}
        aria-label={video.title}
      >
        <source src={video.src} type={type} />
        {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" default />}
        <a href={video.src}>Download the video</a>
      </video>
      <figcaption className="lp-mono text-xs px-1 pt-2" style={{ color: "var(--lp-ink-3)" }}>{video.title}</figcaption>
    </figure>
  );
}
