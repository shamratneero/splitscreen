import { ClaimExperience } from "@/components/claim-experience";
import { demoSplit } from "@/lib/demo-split";

export default async function PublicSplitPage({ params }: { params: Promise<{ token: string }> }) {
  await params;
  // This is intentionally server-rendered. Replace demoSplit with the public Supabase repository in phase 2.
  return <main className="app-shell"><ClaimExperience split={demoSplit} /></main>;
}
