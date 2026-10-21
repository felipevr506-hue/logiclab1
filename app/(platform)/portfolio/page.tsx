import { PortfolioPage } from "@/components/growth-pages";
import { readFeatureFlags } from "@/services/admin/feature-store";
import { PremiumGate } from "@/components/premium-gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await readFeatureFlags();
  if (!flags.PORTFOLIO)
    return (
      <section className="route-state">
        <h1>Portfólio temporariamente indisponível</h1>
        <p>O recurso foi desativado pela administração.</p>
      </section>
    );
  return <PremiumGate feature="portfolio"><PortfolioPage /></PremiumGate>;
}
