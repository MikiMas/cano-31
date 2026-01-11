export default function LandingPage() {
  return (
    <main className="card" style={{ display: "grid", gap: 16 }}>
      <header>
        <div className="brandHero" style={{ fontSize: 28, color: "#fff" }}>
          PIKUDO
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          La app oficial de PIKUDO. Aqui tienes los terminos y la politica de privacidad.
        </p>
      </header>

      <section style={{ display: "grid", gap: 8 }}>
        <a href="/terms" style={{ color: "var(--text)", fontWeight: 700 }}>
          Terminos y condiciones
        </a>
        <a href="/privacy" style={{ color: "var(--text)", fontWeight: 700 }}>
          Politica de privacidad
        </a>
      </section>
    </main>
  );
}
