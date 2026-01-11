"use client";

export function LoadingScreen({ title = "Cargando…" }: { title?: string }) {
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "grid", justifyItems: "center", gap: 12, padding: "10px 6px" }}>
        <div className="spinner" aria-hidden="true" />
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", lineHeight: 1.4 }}>
          Estamos preparando tu pantalla.
        </div>
      </div>
    </section>
  );
}

