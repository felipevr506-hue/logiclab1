import { ProjectsPage } from "@/components/learning-pages";
import { PremiumGate } from "@/components/premium-gate";

export default function Page() {
  return <PremiumGate feature="projects"><ProjectsPage /></PremiumGate>;
}
