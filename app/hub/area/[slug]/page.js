import { notFound } from "next/navigation";
import HubAreaView from "@/components/HubAreaView";
import { HUB_AREA_MAP, HUB_AREAS } from "@/lib/hub-areas";

export function generateStaticParams() {
  return HUB_AREAS.map((area) => ({ slug: area.id }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const area = HUB_AREA_MAP[slug];
  return area ? {
    title: `${area.name} — Amplify Hub`,
    description: area.description,
  } : { title: "Area nao encontrada — Amplify Hub" };
}

export default async function HubAreaPage({ params }) {
  const { slug } = await params;
  const area = HUB_AREA_MAP[slug];
  if (!area) notFound();
  return <HubAreaView area={area} />;
}
