"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "../brand/Logo";

const LINKS = [
  ["/radio/listen", "Listen"], ["/radio/schedule", "Schedule"], ["/radio/shows", "Shows"], ["/radio/djs", "DJs"],
  ["/radio/artists", "Artists"], ["/radio/submit", "Submit Music"], ["/radio/interviews", "Interviews"],
  ["/radio/advertise", "Advertise"], ["/radio/about", "About"], ["/radio/contact", "Contact"],
] as const;

export function PublicNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[var(--color-midnight)]/80 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm lg:hidden" aria-expanded={open} aria-controls="nav-links" onClick={() => setOpen(!open)}>
          Menu
        </button>
        <ul id="nav-links" className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-1 border-b border-white/10 bg-[var(--color-midnight)] p-4 lg:static lg:flex lg:flex-row lg:border-0 lg:bg-transparent lg:p-0`}>
          {LINKS.map(([href, label]) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                  className={`block rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-[var(--color-royal)] text-white" : "text-[var(--color-muted)] hover:text-white"}`}>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
