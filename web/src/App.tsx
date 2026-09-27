import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "/api";

type ApiMarket = {
  id: string;
  sport?: string;
  teams?: string[];
  odds?: Record<string, number>;
  status?: string;
};

type Pick = {
  id: string;
  event: string;
  market: string;
  selection: string;
  odds: number;
};

const sportNav = [
  ["⚽", "Football"],
  ["🏀", "Basketball"],
  ["🏉", "Rugby"],
  ["🎾", "Tennis"],
  ["🏏", "Cricket"],
  ["🏐", "Volleyball"],
  ["🏒", "Ice Hockey"],
  ["🥊", "Combat"],
  ["🎮", "Esports"],
  ["🏁", "Motorsport"],
];

const featuredEvents = [
  {
    id: "f1",
    league: "Premier League",
    time: "LIVE 72'",
    home: "North London",
    away: "Manchester Blue",
    score: "2 : 1",
    odds: [
      ["1", 1.82],
      ["X", 3.6],
      ["2", 4.1],
    ],
  },
  {
    id: "f2",
    league: "Champions League",
    time: "Today 20:00",
    home: "Madrid White",
    away: "Milan Red",
    score: "—",
    odds: [
      ["1", 1.64],
      ["X", 3.95],
      ["2", 5.2],
    ],
  },
  {
    id: "f3",
    league: "NRL",
    time: "Tomorrow 18:30",
    home: "Brisbane",
    away: "Melbourne",
    score: "—",
    odds: [
      ["Home", 1.92],
      ["Line", 1.88],
      ["Away", 2.06],
    ],
  },
  {
    id: "f4",
    league: "NBA",
    time: "Today 21:30",
    home: "Los Angeles",
    away: "Boston",
    score: "—",
    odds: [
      ["Home", 2.2],
      ["Total", 1.91],
      ["Away", 1.74],
    ],
  },
];

const casinoGames = [
  ["⚡", "Crash", "Originals"],
  ["💎", "Mines", "Originals"],
  ["🎯", "Plinko", "Originals"],
  ["🎲", "Dice", "Originals"],
  ["🎡", "Roulette", "Table Games"],
  ["🂡", "Blackjack", "Table Games"],
  ["🃏", "Baccarat", "Table Games"],
  ["🎰", "Slots", "Slots"],
];

const leagues = [
  ["🇬🇧", "Premier League", "42"],
  ["🇪🇺", "Champions League", "28"],
  ["🇦🇺", "NRL", "16"],
  ["🇺🇸", "NBA", "24"],
  ["🌍", "International", "31"],
];

function money(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function App() {
  const [markets, setMarkets] = useState<ApiMarket[]>([]);
  const [health, setHealth] = useState("checking");
  const [activeNav, setActiveNav] = useState("Sportsbook");
  const [activeSport, setActiveSport] = useState("Football");
  const [marketTab, setMarketTab] = useState("Featured");
  const [search, setSearch] = useState("");
  const [bets, setBets] = useState<Pick[]>([]);
  const [stake, setStake] = useState("25");
  const [toast, setToast] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/health`)
      .then(() => setHealth("online"))
      .catch(() => setHealth("offline"));

    axios
      .get(`${API}/sportsbook/markets`)
      .then((r) => setMarkets(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMarkets([]));
  }, []);

  const addPick = (pick: Pick) => {
    setBets((current) => {
      const exists = current.some((x) => x.id === pick.id);
      if (exists) return current.filter((x) => x.id !== pick.id);
      return [...current, pick];
    });
  };

  const combinedOdds = useMemo(
    () => bets.reduce((total, pick) => total * pick.odds, 1),
    [bets]
  );

  const stakeValue = Math.max(0, Number(stake) || 0);
  const potentialReturn = stakeValue * combinedOdds;

  const filteredEvents = featuredEvents.filter((event) => {
    const haystack = `${event.league} ${event.home} ${event.away}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const placeDemoBet = () => {
    if (!bets.length || stakeValue <= 0) return;
    setToast(
      `Demo bet added: ${bets.length} selection${bets.length > 1 ? "s" : ""}, potential return ${money(
        potentialReturn
      )} credits.`
    );
    setTimeout(() => setToast(""), 3500);
  };

  return (
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">G</div>
          <div>
            <div className="brand-name">Gamble<span>stack</span></div>
            <div className="brand-subtitle">TIDALWAVE BETTING PLATFORM</div>
          </div>
        </div>

        <div className="top-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams, leagues, games..."
          />
        </div>

        <div className="top-actions">
          <div className={`api-pill ${health}`}>
            <span className="status-dot" />
            API {health}
          </div>
          <div className="balance-box">
            <span>Demo Credits</span>
            <strong>1,000.00</strong>
          </div>
          <button className="ghost-btn">Log in</button>
          <button className="primary-btn">Create account</button>
        </div>
      </header>

      <nav className="main-nav">
        {["Sportsbook", "Live", "Casino", "Live Casino", "Virtuals", "Esports", "Promotions"].map(
          (item) => (
            <button
              key={item}
              className={activeNav === item ? "active" : ""}
              onClick={() => setActiveNav(item)}
            >
              {item}
              {item === "Live" && <span className="live-dot" />}
            </button>
          )
        )}
      </nav>

      <div className="page-grid">
        <aside className="left-sidebar">
          <div className="sidebar-title">Sports</div>
          <div className="sport-list">
            {sportNav.map(([icon, label]) => (
              <button
                key={label}
                className={activeSport === label ? "active" : ""}
                onClick={() => setActiveSport(label)}
              >
                <span>{icon}</span>
                <span>{label}</span>
                <small>›</small>
              </button>
            ))}
          </div>

          <div className="sidebar-title section-gap">Top leagues</div>
          <div className="league-list">
            {leagues.map(([flag, name, count]) => (
              <button key={name}>
                <span>{flag}</span>
                <span>{name}</span>
                <small>{count}</small>
              </button>
            ))}
          </div>

          <div className="responsible-card">
            <strong>Play responsibly</strong>
            <p>This deployment is running in demo/play-money mode.</p>
            <button>Responsible gaming</button>
          </div>
        </aside>

        <main className="content">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">WELCOME TO GAMESTACK</div>
              <h1>Sports. Casino. One platform.</h1>
              <p>
                Live sportsbook, casino originals, virtual games and a unified account
                experience built on the Gamblestack API.
              </p>
              <div className="hero-actions">
                <button className="hero-primary">Explore sportsbook</button>
                <button className="hero-secondary">Open casino</button>
              </div>
              <div className="hero-trust">
                <span>✓ Unified wallet</span>
                <span>✓ Live API</span>
                <span>✓ Secure SSL</span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <div className="hero-score-card">
                <div className="score-meta"><span>● LIVE</span><span>Football</span></div>
                <div className="score-teams">
                  <div><b>North London</b><small>HOME</small></div>
                  <strong>2 : 1</strong>
                  <div><b>Manchester Blue</b><small>AWAY</small></div>
                </div>
                <div className="score-odds">
                  <button>1 <b>1.82</b></button>
                  <button>X <b>3.60</b></button>
                  <button>2 <b>4.10</b></button>
                </div>
              </div>
            </div>
          </section>

          <section className="quick-stats">
            <div><span>LIVE NOW</span><strong>18</strong><small>events</small></div>
            <div><span>PRE-MATCH</span><strong>146</strong><small>markets</small></div>
            <div><span>CASINO</span><strong>8</strong><small>demo categories</small></div>
            <div><span>API STATUS</span><strong className={health === "online" ? "good" : "bad"}>{health}</strong><small>gateway</small></div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SPORTSBOOK</span>
                <h2>Featured markets</h2>
              </div>
              <div className="tabs">
                {["Featured", "Live", "Upcoming"].map((tab) => (
                  <button
                    key={tab}
                    className={marketTab === tab ? "active" : ""}
                    onClick={() => setMarketTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="event-list">
              {filteredEvents.map((event) => (
                <article className="event-row" key={event.id}>
                  <div className="event-info">
                    <span className={event.time.startsWith("LIVE") ? "event-time live" : "event-time"}>
                      {event.time}
                    </span>
                    <div>
                      <small>{event.league}</small>
                      <strong>{event.home} <span>vs</span> {event.away}</strong>
                    </div>
                    <div className="event-score">{event.score}</div>
                  </div>

                  <div className="event-odds">
                    {event.odds.map(([label, odd]) => {
                      const id = `${event.id}-${label}`;
                      const selected = bets.some((pick) => pick.id === id);
                      return (
                        <button
                          key={id}
                          className={selected ? "selected" : ""}
                          onClick={() =>
                            addPick({
                              id,
                              event: `${event.home} vs ${event.away}`,
                              market: "Match result",
                              selection: String(label),
                              odds: Number(odd),
                            })
                          }
                        >
                          <span>{label}</span>
                          <b>{Number(odd).toFixed(2)}</b>
                        </button>
                      );
                    })}
                  </div>
                  <button className="more-markets">+24</button>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block api-market-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CONNECTED BACKEND</span>
                <h2>Gamblestack API markets</h2>
              </div>
              <span className="connection-badge"><i /> Live data</span>
            </div>

            {markets.length === 0 ? (
              <div className="empty-state">No sportsbook API markets are available yet.</div>
            ) : (
              <div className="api-market-grid">
                {markets.map((m) => (
                  <article key={m.id} className="api-card">
                    <div className="api-card-top">
                      <span>{m.sport || "Sport"}</span>
                      <small>{m.status || "open"}</small>
                    </div>
                    <h3>{m.teams?.join(" vs ") || m.id}</h3>
                    <div className="api-odds">
                      {Object.entries(m.odds || {}).map(([selection, odd]) => {
                        const id = `api-${m.id}-${selection}`;
                        const selected = bets.some((pick) => pick.id === id);
                        return (
                          <button
                            className={selected ? "selected" : ""}
                            key={selection}
                            onClick={() =>
                              addPick({
                                id,
                                event: m.teams?.join(" vs ") || m.id,
                                market: "API market",
                                selection,
                                odds: Number(odd),
                              })
                            }
                          >
                            <span>{selection}</span>
                            <b>{Number(odd).toFixed(2)}</b>
                          </button>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CASINO</span>
                <h2>Popular games</h2>
              </div>
              <button className="text-btn">View all games →</button>
            </div>

            <div className="casino-grid">
              {casinoGames.map(([icon, name, category], index) => (
                <article className={`casino-card casino-${(index % 4) + 1}`} key={name}>
                  <div className="casino-icon">{icon}</div>
                  <div className="casino-tag">{category}</div>
                  <h3>{name}</h3>
                  <p>{name === "Crash" ? "Provably fair engine connected" : "Demo game catalogue"}</p>
                  <button>Play demo</button>
                </article>
              ))}
            </div>
          </section>

          <section className="promo-grid">
            <article className="promo-card promo-purple">
              <span>PROMOTION</span>
              <h3>Welcome rewards</h3>
              <p>Promotion module placeholder ready for your bonus rules and campaigns.</p>
              <button>View promotion</button>
            </article>
            <article className="promo-card promo-blue">
              <span>LIVE CASINO</span>
              <h3>Provider-ready lobby</h3>
              <p>Connect licensed live casino providers and surface their tables here.</p>
              <button>Browse lobby</button>
            </article>
            <article className="promo-card promo-orange">
              <span>VIRTUALS</span>
              <h3>Always-on events</h3>
              <p>Virtual sports and scheduled simulations can plug into this section.</p>
              <button>Explore virtuals</button>
            </article>
          </section>
        </main>

        <aside className="right-sidebar">
          <div className="slip-card">
            <div className="slip-header">
              <div>
                <strong>Bet slip</strong>
                <span>{bets.length}</span>
              </div>
              {bets.length > 0 && <button onClick={() => setBets([])}>Clear</button>}
            </div>

            <div className="slip-tabs">
              <button className="active">Singles</button>
              <button>Multi</button>
              <button>System</button>
            </div>

            {bets.length === 0 ? (
              <div className="empty-slip">
                <div>＋</div>
                <strong>Your bet slip is empty</strong>
                <p>Select an odd from any market to add a demo selection.</p>
              </div>
            ) : (
              <div className="slip-selections">
                {bets.map((pick) => (
                  <div className="slip-selection" key={pick.id}>
                    <button className="remove-pick" onClick={() => addPick(pick)}>×</button>
                    <small>{pick.market}</small>
                    <strong>{pick.selection}</strong>
                    <span>{pick.event}</span>
                    <b>{pick.odds.toFixed(2)}</b>
                  </div>
                ))}
              </div>
            )}

            <div className="stake-box">
              <label>
                <span>Stake</span>
                <div className="stake-input">
                  <input
                    inputMode="decimal"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                  />
                  <span>credits</span>
                </div>
              </label>
              <div className="stake-chips">
                {[10, 25, 50, 100].map((value) => (
                  <button key={value} onClick={() => setStake(String(value))}>+{value}</button>
                ))}
              </div>
            </div>

            <div className="slip-summary">
              <div><span>Total odds</span><strong>{bets.length ? combinedOdds.toFixed(2) : "—"}</strong></div>
              <div><span>Potential return</span><strong>{bets.length ? money(potentialReturn) : "0.00"} credits</strong></div>
            </div>

            <button
              className="place-bet"
              disabled={!bets.length || stakeValue <= 0}
              onClick={placeDemoBet}
            >
              Place demo bet
            </button>
            <p className="demo-note">Demo only — no real-money wagering is enabled.</p>
          </div>

          <div className="account-card">
            <div className="account-icon">◎</div>
            <div>
              <strong>Unified account</strong>
              <span>Wallet, bets & activity</span>
            </div>
            <button>›</button>
          </div>

          <div className="support-card">
            <span>24/7</span>
            <div>
              <strong>Support centre</strong>
              <p>Help, verification and account support.</p>
            </div>
          </div>
        </aside>
      </div>

      <footer className="footer">
        <div className="footer-main">
          <div>
            <div className="brand-name footer-brand">Gamble<span>stack</span></div>
            <p>
              Unified sportsbook and casino platform deployed by Tidalwave Softweb Solutions.
            </p>
          </div>
          <div>
            <strong>Betting</strong>
            <a>Sportsbook</a><a>Live betting</a><a>Virtual sports</a><a>Esports</a>
          </div>
          <div>
            <strong>Casino</strong>
            <a>Originals</a><a>Slots</a><a>Table games</a><a>Live casino</a>
          </div>
          <div>
            <strong>Account</strong>
            <a>Wallet</a><a>Bet history</a><a>Bonuses</a><a>Responsible gaming</a>
          </div>
          <div>
            <strong>Company</strong>
            <a>About</a><a>Help centre</a><a>Terms</a><a>Privacy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Tidalwave Softweb Solutions · Gamblestack</span>
          <span>Demo / development environment · 18+ interface placeholder</span>
        </div>
      </footer>
    </div>
  );
}
