"use client";

import { useEffect } from "react";

export default function SetupIndexPage() {
  useEffect(() => {
    window.location.href = "/";
  }, []);

  return (
    <section className="card">
      <h1 style={{ margin: 0, fontSize: 22 }}>Ajustes de la sala</h1>
      <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>Redirigiendo...</p>
    </section>
  );
}

