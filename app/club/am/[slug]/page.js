import { notFound } from "next/navigation";
import AmCarteiraView from "@/components/AmCarteiraView";
import AmCentralView from "@/components/AmCentralView";
import { AM_BY_SLUG } from "@/lib/am-config";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (slug === "central") return { title: "Central da Corrida — Amplify Club" };
  const am = AM_BY_SLUG[slug];
  return {
    title: am ? `Carteira · ${am.displayName}` : "Carteira não encontrada",
  };
}

export default async function AmCarteiraPage({ params }) {
  const { slug } = await params;
  if (slug === "central") return <AmCentralView />;
  const am = AM_BY_SLUG[slug];
  if (!am) return notFound();
  return <AmCarteiraView slug={slug} />;
}
