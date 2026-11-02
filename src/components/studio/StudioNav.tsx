"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem { href: string; label: string }

export function StudioNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Studio">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {items.map((i) => {
          const active = i.href === "/studio" ? path === "/studio" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-[var(--color-royal)] text-white" : "text-[var(--color-muted)] hover:bg-white/5 hover:text-white"}`}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
