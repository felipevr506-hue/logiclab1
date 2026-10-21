import { WeeklyReportPage } from "@/components/learning-pages";
import { PremiumGate } from "@/components/premium-gate";

export default function Page() {
  return <PremiumGate feature="weekly_report"><WeeklyReportPage /></PremiumGate>;
}
