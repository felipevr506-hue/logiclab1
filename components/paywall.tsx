import Link from "next/link";
import { CheckCircle2, Crown } from "lucide-react";

export function Paywall() {
  return (
    <main className="route-state paywall">
      <span><Crown /></span>
      <h1>Continue sua evolução</h1>
      <p>Este recurso faz parte do Premium.</p>
      <ul>
        {[
          "Trilhas completas",
          "Tutor IA ampliado",
          "Projetos",
          "Recursos avançados",
        ].map((feature) => <li key={feature}><CheckCircle2 /> {feature}</li>)}
      </ul>
      <div>
        <Link className="button button-primary" href="/planos">VER PREMIUM</Link>
        <Link className="button button-secondary" href="/dashboard">AGORA NÃO</Link>
      </div>
    </main>
  );
}
