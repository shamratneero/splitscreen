import { ClaimExperience } from "@/components/claim-experience";
import { fetchPublicSplit } from "@/lib/split-repository";
import { isSupabaseConfigured } from "@/lib/supabase";

// The bill changes as guests claim, so never serve a cached copy.
export const dynamic = "force-dynamic";

export default async function PublicSplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isSupabaseConfigured) {
    return (
      <main className="app-shell">
        <section className="screen">
          <header className="split-header">
            <p className="eyebrow">SplitSave</p>
            <h1>Backend not configured</h1>
            <p>
              Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
              <code>apps/guest-web/.env.local</code>, then restart the dev server.
            </p>
          </header>
        </section>
      </main>
    );
  }

  let split = null;
  let loadError: string | null = null;
  try {
    split = await fetchPublicSplit(token);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Something went wrong";
  }

  if (loadError) {
    return (
      <main className="app-shell">
        <section className="screen">
          <header className="split-header">
            <p className="eyebrow">SplitSave</p>
            <h1>Couldn’t load this split</h1>
            <p>{loadError}</p>
          </header>
        </section>
      </main>
    );
  }

  if (!split) {
    return (
      <main className="app-shell">
        <section className="screen">
          <header className="split-header">
            <p className="eyebrow">SplitSave</p>
            <h1>This link isn’t active</h1>
            <p>Ask the host to share the bill again.</p>
          </header>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <ClaimExperience token={token} initialSplit={split} />
    </main>
  );
}
