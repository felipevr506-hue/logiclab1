import Link from "next/link";
import { ArrowLeft, Route } from "lucide-react";

export default function NotFound() {
  return (
    <main className="route-state">
      <span>
        <Route />
      </span>
      <small>ERRO 404</small>
      <h1>Essa rota não existe.</h1>
      <p>O endereço pode ter mudado ou nunca ter existido.</p>
      <Link href="/" className="button button-primary">
        <ArrowLeft /> Voltar ao início
      </Link>
    </main>
  );
}
