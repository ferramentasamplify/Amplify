import { notFound } from "next/navigation";
import CreatorProfileView from "@/components/CreatorProfileView";
import { AM_BY_SLUG } from "@/lib/am-config";

export async function generateMetadata({ params }) {
  const { slug, handle } = await params;
  const am = AM_BY_SLUG[slug];
  return {
    title: am ? `@${decodeURIComponent(handle)} · ${am.displayName}` : "Creator não encontrado",
  };
}

export default async function CreatorProfilePage({ params }) {
  const { slug, handle } = await params;
  const am = AM_BY_SLUG[slug];
  if (!am) return notFound();
  return <CreatorProfileView slug={slug} handle={decodeURIComponent(handle)} />;
}
