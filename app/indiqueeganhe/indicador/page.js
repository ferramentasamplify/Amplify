import { redirect } from "next/navigation";
import IndicadorDashboardView from "@/components/IndicadorDashboardView";
import { readIndicadorSession } from "@/lib/indicador-auth";

export const metadata = {
  title: "Painel do Indicador — Indique e Ganhe",
};

export const dynamic = "force-dynamic";

export default async function IndicadorDashboardPage() {
  const session = await readIndicadorSession();
  if (!session) redirect("/indiqueeganhe/indicador/login?next=/indiqueeganhe/indicador");
  return <IndicadorDashboardView />;
}
