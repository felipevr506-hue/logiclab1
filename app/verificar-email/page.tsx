import { VerifyEmailFlow } from "@/components/email-verification";
export const metadata = {
  title: "Verificar e-mail",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <VerifyEmailFlow
      token={typeof token === "string" ? token.slice(0, 128) : ""}
    />
  );
}
