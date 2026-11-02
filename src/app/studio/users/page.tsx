import { PageHeader } from "@/components/ui/Panel";
import { UsersManager } from "@/components/studio/UsersManager";
import { requirePagePermission } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const actor = await requirePagePermission("users.manage");
  const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true }, orderBy: { createdAt: "asc" } });
  return (<div className="space-y-4"><PageHeader kicker="Access control" title="Users & roles" /><UsersManager users={users} selfId={actor.id} /></div>);
}
