import { GuestNotice } from "@/components/guest-notice";
import { ClaimExperience } from "@/components/claim-experience";
import { fetchPublicSplit } from "@/lib/split-repository";
import { isSupabaseConfigured } from "@/lib/supabase";

// The bill changes as guests claim, so never serve a cached copy.
export const dynamic = "force-dynamic";

export default async function PublicSplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isSupabaseConfigured) {
    return <GuestNotice title="The table isn’t ready yet" description="We couldn’t connect to this bill. Please try again in a moment." retryHref={`/s/${encodeURIComponent(token)}`} />;
  }

  let split = null;
  let loadError: string | null = null;
  try {
    split = await fetchPublicSplit(token);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Something went wrong";
  }

  if (loadError) {
    return <GuestNotice title="Couldn’t load this split" description="Check your connection and give it another try. Your saved choices will still be here." retryHref={`/s/${encodeURIComponent(token)}`} />;
  }

  if (!split) {
    return <GuestNotice title="This link isn’t active" description="Ask the host to share the bill again, then open their new link or scan the QR code." />;
  }

  return (
    <main className="app-shell">
      <ClaimExperience token={token} initialSplit={split} />
    </main>
  );
}
