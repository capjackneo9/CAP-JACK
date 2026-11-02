import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/5 pb-28">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="font-[family-name:var(--font-display)] text-lg font-bold text-gold-gradient">NCVR</div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{BRAND.tagline}</p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">A {BRAND.owner} network station · 24/7 · Eastern Time</p>
        </div>
        <ul className="space-y-1 text-sm text-[var(--color-muted)]">
          <li><Link className="hover:text-white" href="/radio/schedule">Schedule</Link></li>
          <li><Link className="hover:text-white" href="/radio/submit">Submit music</Link></li>
          <li><Link className="hover:text-white" href="/radio/advertise">Advertise & sponsor</Link></li>
          <li><Link className="hover:text-white" href="/radio/about">About & ownership</Link></li>
        </ul>
        <div className="text-xs text-[var(--color-muted)]">
          <p>Sponsored content is identified on-air and on this website. Paid review never guarantees airplay.</p>
          <p className="mt-2"><a className="hover:text-white" href={BRAND.mainSite}>capriojacksoncoded.si</a> · <Link className="hover:text-white" href="/login">Studio</Link></p>
          <p className="mt-2">© {new Date().getFullYear()} {BRAND.owner}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
