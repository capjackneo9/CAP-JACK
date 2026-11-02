"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, ROLE_LABELS } from "@/lib/rbac";

interface U { id: string; email: string; name: string; role: string; active: boolean }

export function UsersManager({ users, selfId }: { users: U[]; selfId: string }) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function call(method: string, body: object) {
    setErr(null);
    const r = await fetch("/api/studio/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    if (j.temporaryPassword) setSecret(j.temporaryPassword);
    router.refresh();
  }
  return (
    <div className="space-y-4">
      <form className="glass grid gap-2 p-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); call("POST", Object.fromEntries(f)); e.currentTarget.reset(); }}>
        <input name="name" required placeholder="Name" className="field text-sm" aria-label="Name" />
        <input name="email" type="email" required placeholder="Email" className="field text-sm" aria-label="Email" />
        <select name="role" className="field text-sm" aria-label="Role">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
        <button className="btn btn-primary text-sm">Add user</button>
      </form>
      {secret && <div role="status" className="rounded-xl border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 p-3 text-sm">Temporary password (shown once — share securely): <code className="font-mono">{secret}</code></div>}
      {err && <p className="text-sm text-red-300">{err}</p>}
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-[var(--color-muted)]"><tr><th className="p-3">User</th><th>Role</th><th>Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="p-3"><div className="font-semibold">{u.name}</div><div className="text-xs text-[var(--color-muted)]">{u.email}</div></td>
                <td><select aria-label={`Role for ${u.name}`} className="field w-auto text-xs" value={u.role} disabled={u.id === selfId} onChange={(e) => call("PATCH", { id: u.id, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></td>
                <td>{u.active ? "Active" : "Disabled"}</td>
                <td className="space-x-2 p-3">
                  {u.id !== selfId && <button type="button" className="text-xs text-[var(--color-gold)] hover:underline" onClick={() => call("PATCH", { id: u.id, active: !u.active })}>{u.active ? "Disable" : "Enable"}</button>}
                  <button type="button" className="text-xs text-[var(--color-gold)] hover:underline" onClick={() => call("PATCH", { id: u.id, resetPassword: true })}>Reset password</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
