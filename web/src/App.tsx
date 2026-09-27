import React, { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "/api";

export default function App() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [health, setHealth] = useState("checking");

  useEffect(() => {
    axios.get(`${API}/health`)
      .then(() => setHealth("online"))
      .catch(() => setHealth("offline"));

    axios.get(`${API}/sportsbook/markets`)
      .then((r) => setMarkets(r.data))
      .catch(() => setMarkets([]));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Gamblestack</h1>
      <p>API: <strong>{health}</strong></p>

      <section>
        <h2>Sportsbook Markets</h2>
        {markets.length === 0 && <p>No markets available.</p>}
        {markets.map((m) => (
          <div key={m.id} style={{ border: "1px solid #ddd", padding: 12, margin: "10px 0", borderRadius: 8 }}>
            <div><strong>{m.sport}</strong> — {m.teams?.join(" vs ")}</div>
            <div>Odds: {JSON.stringify(m.odds)}</div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Casino Engine</h2>
        <p>Provably-fair game API is available through the unified API gateway.</p>
      </section>
    </div>
  );
}
