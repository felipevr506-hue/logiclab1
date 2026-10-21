import { ReviewPage } from "@/components/platform-pages";
import { PremiumGate } from "@/components/premium-gate";
export default function Page() { return <PremiumGate feature="spaced_review"><ReviewPage /></PremiumGate>; }
