import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Logo({ size = 44, withText = true, href = "/radio" }: { size?: number; withText?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3" aria-label={`${BRAND.name} home`}>
      <Image src={BRAND.logo} alt="" width={size} height={size} priority unoptimized />
      {withText && (
        <span className="leading-tight">
          <span className="block font-[family-name:var(--font-display)] text-lg font-extrabold tracking-[0.2em] text-gold-gradient">NCVR</span>
          <span className="block text-[10px] uppercase tracking-[0.25em] text-[var(--color-muted)]">Nite Cap Vibe Radio</span>
        </span>
      )}
    </Link>
  );
}
