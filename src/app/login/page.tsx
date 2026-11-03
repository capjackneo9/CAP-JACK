import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Emblem } from "@/components/brand/Logo";
import { MatrixBackground } from "@/components/brand/MatrixBackground";

export const metadata = { title: "Studio sign-in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const sp = await searchParams;
  async function login(form: FormData) {
    "use server";
    try {
      await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirectTo: "/studio" });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e;
    }
  }
  return (
    <main id="main" className="grid min-h-screen place-items-center p-4">
      <MatrixBackground intensity={0.25} />
      <form action={login} className="glass w-full max-w-sm space-y-4 p-6">
        <a href="/radio" aria-label="NCVR home" className="mx-auto block w-40"><Emblem priority /></a>
        <h1 className="text-center font-[family-name:var(--font-display)] text-xl font-bold">NCVR Studio</h1>
        <p className="text-center text-sm text-[var(--color-muted)]">Authorized station staff only.</p>
        {sp.error && <p role="alert" className="rounded border border-red-400/40 bg-red-500/10 p-2 text-sm text-red-200">Sign-in failed. Check your email and password.</p>}
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="field" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
        <button className="btn btn-primary w-full">Enter studio</button>
      </form>
    </main>
  );
}
