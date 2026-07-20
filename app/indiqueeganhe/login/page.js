import { Suspense } from "react";
import IndiqueAdminLoginView from "@/components/IndiqueAdminLoginView";

export const metadata = {
  title: "Login Acesso Total — Indique e Ganhe",
};

export const dynamic = "force-dynamic";

export default function IndiqueAdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0B12] text-white flex items-center justify-center text-white/40">Carregando...</div>}>
      <IndiqueAdminLoginView />
    </Suspense>
  );
}
