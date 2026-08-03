import { Suspense } from "react";
import HubRegistryManager from "@/components/HubRegistryManager";

export const metadata = {
  title: "Gestao global — Amplify Hub",
  description: "Cadastro e distribuicao dos dashboards, sistemas e links entre as areas da Amplify.",
};

export const dynamic = "force-dynamic";

export default function HubManagementPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#090a0f] p-8 text-white/50">Carregando gestao do Hub...</main>}><HubRegistryManager /></Suspense>;
}
