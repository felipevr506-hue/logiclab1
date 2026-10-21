import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/components/auth-flows";

export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ForgotPasswordPage />;
}
