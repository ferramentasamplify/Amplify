import { Suspense } from "react";
import AmLoginView from "@/components/AmLoginView";

export const metadata = {
  title: "Login AM — Amplify Club",
};

export default function AmLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0B12] text-white flex items-center justify-center text-white/40">Carregando…</div>}>
      <AmLoginView />
    </Suspense>
  );
}