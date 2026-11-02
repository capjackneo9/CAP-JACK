import { MatrixBackground } from "@/components/brand/MatrixBackground";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { PlayerBar } from "@/components/player/PlayerBar";
import { PublicNav } from "@/components/radio/PublicNav";
import { Footer } from "@/components/radio/Footer";

export default function RadioLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <MatrixBackground intensity={0.35} />
      <PublicNav />
      <main id="main" className="mx-auto max-w-7xl px-4 pt-8">{children}</main>
      <Footer />
      <PlayerBar />
    </PlayerProvider>
  );
}
