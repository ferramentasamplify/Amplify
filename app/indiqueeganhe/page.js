import { redirect } from "next/navigation";
import IndiqueEGanheView from "@/components/IndiqueEGanheView";
import { readIndiqueAdminSession } from "@/lib/indique-admin-auth";

export const metadata = {
  title: "Indique e Ganhe — Amplify",
};

export const dynamic = "force-dynamic";

export default async function IndiqueEGanhePage() {
  const session = await readIndiqueAdminSession();
  if (!session) redirect("/indiqueeganhe/login?next=/indiqueeganhe");
  return <IndiqueEGanheView />;
}
