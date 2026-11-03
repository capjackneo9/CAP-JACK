import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

/**
 * Header logo: round NCVR emblem + the "NCVR · Nite Cap Vibe Radio" wordmark.
 * `size` is the emblem height in px; the wordmark scales with it.
 */
export function Logo({ size = 56, withText = true, href = "/radio" }: { size?: number; withText?: boolean; href?: string }) {
  const wordH = Math.round(size * 0.78);
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2" aria-label={`${BRAND.name} home`}>
      <Image src={BRAND.logo} alt="" width={Math.round(size * 1.05)} height={size} priority unoptimized
        className="drop-shadow-[0_0_10px_rgba(47,91,255,0.45)]" />
      {withText && (
        <Image src={BRAND.wordmark} alt="NCVR — Nite Cap Vibe Radio" width={Math.round(wordH * 3.29)} height={wordH} priority unoptimized
          className="hidden sm:block" />
      )}
    </Link>
  );
}

/** Large text logo for hero sections and footers. */
export function Wordmark({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image src={BRAND.wordmark} alt="NCVR — Nite Cap Vibe Radio" width={1200} height={365} priority={priority} unoptimized
      className={`h-auto w-full drop-shadow-[0_0_24px_rgba(255,0,168,0.25)] ${className}`} />
  );
}

/** Large round badge. */
export function Emblem({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image src={BRAND.logo} alt="NCVR — Nite Cap Vibe Radio emblem" width={640} height={608} priority={priority} unoptimized
      className={`h-auto w-full drop-shadow-[0_0_30px_rgba(47,91,255,0.45)] ${className}`} />
  );
}
