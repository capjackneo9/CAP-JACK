import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div>
        <div className="kicker">404 // signal lost</div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">Nothing on this frequency</h1>
        <Link className="btn btn-primary mt-6" href="/radio">Back to NCVR</Link>
      </div>
    </main>
  );
}
