import { redirect } from "next/navigation";
import { readSession } from "@/lib/am-auth";

export default async function AmIndex() {
  const session = await readSession();
  if (!session) {
    redirect("/club/am/login?next=/club/am");
  }
  redirect(session.am.isAdmin ? "/club/am/central" : `/club/am/${session.slug}`);
}
