import { redirect } from "next/navigation";

export default async function LoginAlias({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
}
