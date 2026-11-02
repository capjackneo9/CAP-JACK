import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * Renders an original brand asset from /public when present. When the file has
 * not been supplied yet it shows a clearly labelled placeholder frame — never a
 * substitute face.
 */
export function BrandImage({
  src, alt, width, height, className = "", glow = "royal",
}: { src: string | null | undefined; alt: string; width: number; height: number; className?: string; glow?: "royal" | "gold" | "none" }) {
  const exists = src && src.startsWith("/") && existsSync(path.join(process.cwd(), "public", src));
  const ring = glow === "gold" ? "shadow-[var(--shadow-glow-gold)] border-[var(--color-gold)]/50" : glow === "royal" ? "shadow-[var(--shadow-glow-royal)] border-[var(--color-royal-400)]/40" : "border-white/10";
  if (src && src.startsWith("/api/media/")) {
    return (
      <div className={`relative overflow-hidden rounded-2xl border ${ring} ${className}`} style={{ aspectRatio: `${width}/${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }
  if (exists) {
    return (
      <div className={`relative overflow-hidden rounded-2xl border ${ring} ${className}`} style={{ aspectRatio: `${width}/${height}` }}>
        <Image src={src!} alt={alt} fill sizes={`${width}px`} className="object-cover" />
      </div>
    );
  }
  return (
    <div role="img" aria-label={`${alt} (artwork pending upload)`}
      className={`circuit-bg relative grid place-items-center overflow-hidden rounded-2xl border border-dashed ${ring} ${className}`}
      style={{ aspectRatio: `${width}/${height}` }}>
      <div className="p-4 text-center">
        <div className="kicker">Artwork pending</div>
        <div className="mt-1 text-xs text-[var(--color-muted)]">{alt}</div>
        {src && <code className="mt-2 block text-[10px] text-[var(--color-muted)]/70">public{src}</code>}
      </div>
    </div>
  );
}
