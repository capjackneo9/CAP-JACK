import { GuestRoom } from "./GuestRoom";
import { Logo } from "@/components/brand/Logo";

export const metadata = { title: "Guest studio", robots: { index: false, follow: false } };

export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main id="main" className="circuit-bg min-h-screen p-4">
      <div className="mx-auto max-w-2xl space-y-6 pt-8">
        <Logo href="/radio" />
        <GuestRoom token={token} />
      </div>
    </main>
  );
}
