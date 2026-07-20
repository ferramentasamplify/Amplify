import MetaAdsView from "@/components/MetaAdsView";

export const metadata = {
  title: "Meta Ads — Amplify",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MetaPage() {
  return <MetaAdsView />;
}
