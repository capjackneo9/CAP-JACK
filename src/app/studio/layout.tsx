import { signOut } from "@/auth";
import { Logo } from "@/components/brand/Logo";
import { StudioNav, type NavItem } from "@/components/studio/StudioNav";
import { requirePagePermission } from "@/lib/session";
import { can, ROLE_LABELS, type Permission } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio", robots: { index: false, follow: false } };

const NAV: Array<NavItem & { perm: Permission }> = [
  { href: "/studio", label: "Dashboard", perm: "studio.access" },
  { href: "/studio/console", label: "Broadcast console", perm: "console.broadcast" },
  { href: "/studio/schedule", label: "Scheduler", perm: "schedule.view" },
  { href: "/studio/library", label: "Music library", perm: "library.view" },
  { href: "/studio/submissions", label: "Submissions", perm: "submissions.review" },
  { href: "/studio/bookings", label: "Bookings & sponsors", perm: "bookings.manage" },
  { href: "/studio/guests", label: "Guest rooms", perm: "guests.invite" },
  { href: "/studio/videos", label: "NCVR TV", perm: "video.manage" },
  { href: "/studio/team", label: "Team applications", perm: "interns.review" },
  { href: "/studio/settings", label: "Station settings", perm: "settings.rotation" },
  { href: "/studio/users", label: "Users", perm: "users.manage" },
  { href: "/studio/audit", label: "Audit log", perm: "audit.view" },
];

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePagePermission("studio.access");
  const items = NAV.filter((n) => can(actor.role, n.perm));
  return (
    <div className="circuit-bg min-h-screen">
      <div className="mx-auto grid max-w-[1600px] gap-4 p-3 lg:grid-cols-[230px_1fr] lg:p-4">
        <aside className="glass-strong flex flex-col gap-4 p-3 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <Logo href="/studio" size={40} />
          <div className="kicker hidden lg:block">NCVR // Control system</div>
          <StudioNav items={items} />
          <div className="mt-auto hidden border-t border-white/10 pt-3 text-xs text-[var(--color-muted)] lg:block">
            <div className="font-semibold text-white">{actor.name}</div>
            <div>{ROLE_LABELS[actor.role]}</div>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button className="mt-2 text-[var(--color-gold)] hover:underline">Sign out</button>
            </form>
          </div>
        </aside>
        <main id="main" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
