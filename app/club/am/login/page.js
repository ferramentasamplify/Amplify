import { Suspense } from "react";
import { redirect } from "next/navigation";
import AmLoginView from "@/components/AmLoginView";
import { readSession } from "@/lib/am-auth";

export const metadata = {
  title: "Login AM — Amplify Club",
};

export const dynamic = "force-dynamic";

export default async function AmLoginPage() {
  const session = await readSession();
  if (session) {
    redirect(session.am.isAdmin ? "/club/am/central" : `/club/am/${session.slug}`);
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0B12] text-white flex items-center justify-center text-white/40">Carregando…</div>}>
      <AmLoginView />
    </Suspense>
  );
}
