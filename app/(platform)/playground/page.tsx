import { PlaygroundPage } from "@/components/playground-page";
import { readFeatureFlags } from "@/services/admin/feature-store";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await readFeatureFlags();
  if (!flags.PLAYGROUND)
    return (
      <section className="route-state">
        <h1>Playground temporariamente indisponível</h1>
        <p>O recurso foi desativado pela administração.</p>
      </section>
    );
  return <PlaygroundPage />;
}
