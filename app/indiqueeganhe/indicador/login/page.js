import { Suspense } from "react";
import { redirect } from "next/navigation";
import IndicadorLoginView from "@/components/IndicadorLoginView";
import { readIndicadorSession } from "@/lib/indicador-auth";

export const metadata = {
  title: "Login Indicador — Indique e Ganhe",
};

export const dynamic = "force-dynamic";

export default async function IndicadorLoginPage({ searchParams }) {
  const session = await readIndicadorSession();
  const sp = await searchParams;
  const next = typeof sp?.next === "string" && sp.next.startsWith("/") ? sp.next : "/indiqueeganhe/indicador";
  if (session) redirect(next.startsWith("/indiqueeganhe/indicador/login") ? "/indiqueeganhe/indicador" : next);

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0B12] text-white flex items-center justify-center text-white/40">Carregando...</div>}>
      <IndicadorLoginView />
    </Suspense>
  );
}
