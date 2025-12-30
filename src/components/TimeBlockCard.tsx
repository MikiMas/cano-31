"use client";

import { useEffect, useMemo, useState } from "react";
import { getBlockStartUTC, secondsToNextBlock } from "@/lib/timeBlock";

export function TimeBlockCard() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(id);
  }, []);

  const blockStartIso = useMemo(() => getBlockStartUTC(now).toISOString(), [now]);
  const seconds = useMemo(() => secondsToNextBlock(now), [now]);

  return (
    <section className="card">
      <h2 style={{ margin: 0, fontSize: 18 }}>Time block (UTC)</h2>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="pill">
          <strong>block_start</strong> {blockStartIso}
        </span>
        <span className="pill">
          <strong>siguiente</strong> {seconds}s
        </span>
      </div>
    </section>
  );
}

