import Link from "next/link";
import { Wrench } from "lucide-react";
import { Brand } from "@/components/brand";

export default function MaintenancePage() {
  return (
    <main className="maintenance-page">
      <Brand />
      <section className="panel-card">
        <span className="maintenance-icon" aria-hidden="true">
          <Wrench />
        </span>
        <p className="eyebrow">MANUTENÇÃO PROGRAMADA</p>
        <h1>Estamos cuidando do laboratório.</h1>
        <p>
          O acesso foi pausado temporariamente para uma atualização segura. Seu
          progresso salvo não será apagado.
        </p>
        <Link className="button button-secondary" href="/api/status">
          Consultar status técnico
        </Link>
      </section>
    </main>
  );
}
