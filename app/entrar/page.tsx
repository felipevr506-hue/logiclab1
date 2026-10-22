export default function LoginPage() {
  return (
    <main className="route-state">
      <h1>Bem-vindo ao LogicLab</h1>
      <p>Entre como convidado, sem cadastro e sem senha.</p>
      <form action="/convidado" method="post">
        <button className="button button-primary" type="submit">
          Entrar como convidado
        </button>
      </form>
      <p>Seu progresso fica salvo apenas neste navegador.</p>
    </main>
  );
}
