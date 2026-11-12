import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/chat");
  return (
    <AppShell user={user}>
      <AdminClient />
    </AppShell>
  );
}
