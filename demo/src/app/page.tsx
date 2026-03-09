'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from "react";

// ─── Theme ──────────────────────────────────────────────
const C = {
  bg: "#030712", card: "#111827", cardHover: "#1f2937",
  accent: "#ef4444", accentGlow: "rgba(239,68,68,0.12)", accentSoft: "#f87171",
  text: "#ffffff", muted: "#9ca3af", dim: "#6b7280",
  border: "#1f2937", borderHover: "#374151",
  green: "#22c55e", blue: "#3b82f6", purple: "#a855f7", amber: "#f59e0b",
};

function useInView(t = 0.1): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect(); } }, { threshold: t });
    o.observe(el);
    return () => o.disconnect();
  }, [t]);
  return [ref, v];
}

function Reveal({ children, delay = 0, className = "", style = {} }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const [ref, v] = useInView(0.08);
  return (
    <div ref={ref} className={className} style={{
      ...style,
      opacity: v ? 1 : 0,
      transform: v ? "translateY(0)" : "translateY(28px)",
      transition: `opacity 0.6s ${delay}s cubic-bezier(.16,1,.3,1), transform 0.6s ${delay}s cubic-bezier(.16,1,.3,1)`,
    }}>{children}</div>
  );
}

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const X = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
);

// ─── Block 1: Hero ──────────────────────────────────────
function Hero() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "100px 24px 80px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: 800, height: 800, borderRadius: "50%", background: `radial-gradient(circle, ${C.accentGlow} 0%, transparent 65%)`, pointerEvents: "none" }}/>
      <div style={{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: `linear-gradient(${C.muted} 1px, transparent 1px), linear-gradient(90deg, ${C.muted} 1px, transparent 1px)`, backgroundSize: "72px 72px", pointerEvents: "none" }}/>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 100, background: C.accentGlow, border: `1px solid rgba(232,65,66,0.2)`, marginBottom: 28, fontSize: 12, fontWeight: 600, color: C.accentSoft, letterSpacing: "0.02em" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }}/>
          Avalanche Build Games 2026
        </div>

        <h1 style={{ fontSize: "clamp(38px, 6.5vw, 72px)", fontWeight: 800, lineHeight: 1.06, letterSpacing: "-0.04em", color: C.text, margin: "0 0 20px" }}>
          One Fingerprint.<br/>
          <span style={{ color: C.accent }}>Every Asset.</span>
        </h1>

        <p style={{ fontSize: "clamp(15px, 2vw, 19px)", color: C.muted, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 36px" }}>
          Smart wallet for Avalanche that replaces seed phrases with Face ID.
          Invest in real-world assets, trade tokens, play Web3 games, power AI agents — no crypto knowledge, no gas fees, no network switching.
        </p>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/app" style={{ background: C.accent, color: "#fff", padding: "13px 28px", borderRadius: 10, textDecoration: "none", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `0 6px 28px ${C.accentGlow}` }}>
            Try Demo <Arrow/>
          </Link>
          <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noreferrer" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.text, padding: "13px 28px", borderRadius: 10, textDecoration: "none", fontSize: 15, fontWeight: 600 }}>
            Documentation
          </a>
        </div>

        <div className="lp-stats" style={{ display: "flex", gap: 40, justifyContent: "center", marginTop: 56, flexWrap: "wrap" }}>
          {[["3", "Blockchains"], ["0", "Seed Phrases"], ["1 Tap", "To Invest"], ["<2s", "Transaction"]].map(([v, l], i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: C.accent }}>{v}</div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 3, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @media(max-width:768px){
          .lp-nav-inner{padding:12px 16px !important;}
          .lp-nav-btn{padding:7px 14px !important; font-size:12px !important;}
          .lp-section{padding:48px 16px !important;}
          .lp-grid-2{grid-template-columns:1fr !important;}
          .lp-grid-4{grid-template-columns:1fr 1fr !important;}
          .lp-card{padding:24px 18px !important;}
          .lp-heading{font-size:28px !important;}
          .lp-stats{gap:24px !important; display:grid !important; grid-template-columns:1fr 1fr !important;}
          .lp-footer{flex-direction:column !important; align-items:flex-start !important; gap:12px !important;}
          .lp-code{padding:16px !important; font-size:11.5px !important;}
          .lp-sdk-card{padding:28px 18px !important;}
          .lp-table-wrap{margin:0 -16px; padding:0 16px;}
          .lp-scroll-hint{display:block !important; animation:lp-fade 2s ease-in-out infinite;}
        }
        @keyframes lp-fade{0%,100%{opacity:0.4}50%{opacity:1}}
        @media(max-width:480px){
          .lp-grid-4{grid-template-columns:1fr !important;}
        }
      `}</style>
    </div>
  );
}

// ─── Block 2: Problem → Solution ────────────────────────
function ProblemSolution() {
  return (
    <Reveal>
      <div className="lp-section" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
        <div className="lp-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Problem */}
          <div className="lp-card" style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: 36 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Now: 7 steps to buy a token on another L1</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Write down 12-word seed phrase", "Install wallet extension", "Add network manually (RPC, Chain ID)", "Buy gas token on exchange", "Transfer gas token to wallet", "Confirm tx via confusing popup", "Repeat for every new chain"].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color: C.accent }}>{i + 1}</span>
                  <span style={{ fontSize: 14, color: C.muted }}>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: "10px 16px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)", fontSize: 13, color: C.accentSoft }}>
              95% of non-crypto users drop off before step 3.
            </div>
          </div>

          {/* Solution */}
          <div className="lp-card" style={{ background: C.card, borderRadius: 20, border: `1px solid rgba(34,197,94,0.15)`, padding: 36, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.green}, transparent)` }}/>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>With OneClick: 1 step</div>
            <div className="lp-heading" style={{ fontSize: 32, fontWeight: 800, color: C.text, lineHeight: 1.15, marginBottom: 24 }}>Tap your finger.<br/>Done.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["No seed phrases", "Key lives in Secure Enclave \u2014 same chip as Apple Pay"],
                ["No network switching", "One address on all L1s, auto-routing"],
                ["No gas fees", "dApp pays via Paymaster"],
                ["No manual swaps", "Need USDC but have AVAX? Smart Route handles it"],
                ["No extensions", "Works in any browser via WebAuthn"],
              ].map(([t, d], i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><Check/></div>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t}</span>
                    <span style={{ fontSize: 13, color: C.muted }}> — {d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// ─── Block 3: Three Verticals (Tabs) ────────────────────
function Verticals() {
  type Vertical = "rwa" | "gaming" | "defi" | "ai";
  const [active, setActive] = useState<Vertical>("rwa");
  const data = {
    rwa: {
      label: "RWA",
      color: C.amber,
      tagline: "Real-world assets for real people",
      forProjects: [
        "Access mass audience \u2014 your investors aren\u2019t crypto natives, they\u2019re Robinhood users. They won\u2019t install MetaMask",
        "Built-in fiat on-ramp \u2014 users fund wallet with Visa/Apple Pay, money converts to stablecoins instantly",
        "Single entry point \u2014 your tokens on different L1s? User doesn\u2019t need to know. OneClick routes automatically",
        "Sponsored gas \u2014 you can\u2019t ask someone to invest $100 in bonds and first buy AVAX for fees",
      ],
      forUsers: [
        "Like Robinhood, but on blockchain \u2014 familiar UX, blockchain transparency",
        "Fingerprint login, card funding, portfolio in USD",
        "Real estate from $10, T-Bills 24/7, gold without storage",
        "No crypto jargon \u2014 you never see L1, gas, nonce, or transaction",
      ],
    },
    gaming: {
      label: "Gaming",
      color: C.purple,
      tagline: "Players play, not configure wallets",
      forProjects: [
        "Zero-friction onboarding \u2014 player taps finger and plays. No MetaMask, no seed phrase, no network setup",
        "Gas as marketing spend \u2014 sponsor via Paymaster. Cheaper than ads, better conversion",
        "30-min SDK integration \u2014 5 lines of code replaces weeks of WalletConnect setup",
        "Session Keys (roadmap) \u2014 authorize game for 1hr/50 txs. No re-auth per action. Critical for real-time games",
      ],
      forUsers: [
        "Enter game in 3 seconds \u2014 touch finger, play",
        "No need to understand blockchain at all",
        "Zero gas fees, zero popups",
        "One wallet across all Avalanche games \u2014 cross-game inventory",
      ],
    },
    defi: {
      label: "DeFi",
      color: C.blue,
      tagline: "Liquidity without barriers",
      forProjects: [
        "Liquidity from any L1 \u2014 users interact with your protocol regardless of which chain it\u2019s on",
        "Ready auth layer for new L1 \u2014 launching your Avalanche L1? Don\u2019t ask users to configure RPC. Give them OneClick",
        "Paymaster for growth \u2014 sponsor first N transactions, reduce barrier, increase TVL",
        "Batch transactions (roadmap) \u2014 approve + swap + stake in one fingerprint tap",
      ],
      forUsers: [
        "Unified balance across all L1s \u2014 one dashboard, USD prices",
        "Smart Route \u2014 want to provide USDC liquidity but hold AVAX? One tap: swap and deposit",
        "Secure Enclave key \u2014 not in browser extension that can be compromised",
        "Zero gas on Avalanche L1s \u2014 protocol sponsors it",
      ],
    },
    ai: {
      label: "AI Agents",
      color: C.green,
      tagline: "Blockchain execution layer for AI",
      forProjects: [
        "Agent SDK \u2014 connect any LLM (Claude, GPT, open-source) to on-chain actions via session keys with granular permissions",
        "MCP Server \u2014 OneClick as a tool for AI models. Agent calls execute(), OneClick handles chains, gas, and swaps automatically",
        "Smart Route for agents \u2014 agent says \u201Cbuy X for $Y\u201D, OneClick figures out which L1, which DEX, which token path",
        "Paymaster for agents \u2014 no need to fund agent with gas tokens on each chain. dApp sponsors via Paymaster",
      ],
      forUsers: [
        "AI robo-advisor for RWA \u2014 set strategy once (\u201C60% bonds, 30% real estate, 10% gold\u201D), AI rebalances monthly",
        "DeFi automation \u2014 yield optimizer moves liquidity across L1s chasing best APY. Session key limits the risk",
        "Gaming AI companions \u2014 NPC with real wallet trades items, companion auto-loots and sells. All within permission bounds",
        "One fingerprint to authorize \u2014 you set the rules, AI executes. Revoke anytime with one tap",
      ],
    },
  };

  const d = data[active];

  return (
    <Reveal>
      <div className="lp-section" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Use Cases</p>
          <h2 className="lp-heading" style={{ fontSize: 36, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", margin: 0 }}>One platform. Four markets.</h2>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {Object.entries(data).map(([key, val]) => (
            <button key={key} onClick={() => setActive(key as Vertical)} style={{
              padding: "10px 28px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
              background: active === key ? val.color + "18" : "transparent",
              border: `1px solid ${active === key ? val.color + "40" : C.border}`,
              color: active === key ? val.color : C.muted,
              transition: "all 0.2s",
            }}>{val.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="lp-card" style={{ background: C.card, borderRadius: 20, border: `1px solid ${d.color}20`, padding: 40, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${d.color}, transparent)` }}/>

          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>{d.tagline}</div>

          <div className="lp-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: d.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>For Projects</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {d.forProjects.map((item, i) => {
                  const [bold, ...rest] = item.split(" \u2014 ");
                  return (
                    <div key={i} style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{bold}</span>
                      {rest.length > 0 && <span> — {rest.join(" — ")}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: d.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>For Users</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {d.forUsers.map((item, i) => {
                  const [bold, ...rest] = item.split(" \u2014 ");
                  return (
                    <div key={i} style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{bold}</span>
                      {rest.length > 0 && <span> — {rest.join(" — ")}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// ─── Block 4: How It Works + Comparison ─────────────────
function HowAndCompare() {
  const steps = [
    { n: "01", title: "Open the app", desc: "Any browser. Nothing to install.", color: C.blue },
    { n: "02", title: "Tap your finger", desc: "Face ID / Touch ID. Key in Secure Enclave.", color: C.accent },
    { n: "03", title: "Fund with card", desc: "Visa, Apple Pay. Instant stablecoin conversion.", color: C.green },
    { n: "04", title: "Act in one tap", desc: "Invest, swap, send. Auto-routing, auto-swap, zero gas.", color: C.amber },
  ];

  const comparison = [
    { feature: "Auth", metamask: "Seed phrase", biconomy: "Seed + AA", abstract: "Passkey", oneclick: "Passkey (on-chain P256)" },
    { feature: "Multi-chain", metamask: false, biconomy: "1 chain", abstract: "1 L2", oneclick: "All Avalanche L1s" },
    { feature: "Auto-swap", metamask: false, biconomy: false, abstract: false, oneclick: "Smart Route" },
    { feature: "Gas sponsorship", metamask: false, biconomy: true, abstract: true, oneclick: true },
    { feature: "Cross-chain sync", metamask: false, biconomy: false, abstract: false, oneclick: "ICM" },
    { feature: "Same address everywhere", metamask: false, biconomy: "Partial", abstract: false, oneclick: "CREATE2" },
    { feature: "Fiat on-ramp", metamask: false, biconomy: false, abstract: false, oneclick: "Roadmap" },
    { feature: "Integration time", metamask: "Days", biconomy: "Hours", abstract: "Hours", oneclick: "30 min" },
    { feature: "Vendor lock-in", metamask: false, biconomy: false, abstract: "Abstract chain", oneclick: "None (open source)" },
    { feature: "AI agent support", metamask: false, biconomy: "Basic", abstract: false, oneclick: "Session keys + MCP" },
  ];

  function CellVal({ val }: { val: boolean | string }) {
    if (val === true) return <Check/>;
    if (val === false) return <X/>;
    return <span style={{ fontSize: 12.5, fontWeight: 500 }}>{val}</span>;
  }

  return (
    <Reveal>
      <div className="lp-section" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>How It Works</p>
          <h2 className="lp-heading" style={{ fontSize: 36, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", margin: 0 }}>Zero to invested in 2 minutes</h2>
        </div>

        {/* Steps */}
        <div className="lp-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 56 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px 20px", textAlign: "center", transition: "border-color 0.3s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = s.color + "40"}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.color + "12", border: `1px solid ${s.color}25`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 15, fontWeight: 800, color: s.color }}>{s.n}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Comparison */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Why Not MetaMask?</p>
          <p style={{ fontSize: 13, color: C.dim }}>Privy acquired by Stripe. Dynamic acquired by Fireblocks. The market is consolidating. OneClick is independent and open-source.</p>
        </div>

        <div className="lp-scroll-hint" style={{ display: "none", textAlign: "center", fontSize: 12, color: C.dim, marginBottom: 8 }}>
          Swipe to compare →
        </div>
        <div className="lp-table-wrap" style={{ borderRadius: 16, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", minWidth: 760 }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.6fr 1.3fr 1.3fr 1.3fr", borderBottom: `1px solid ${C.border}` }}>
            {["", "OneClick", "MetaMask", "Biconomy", "Abstract"].map((h, i) => (
              <div key={i} style={{
                padding: "12px 16px", fontSize: 12, fontWeight: 700, color: i === 1 ? C.accent : C.muted,
                textTransform: "uppercase", letterSpacing: "0.06em",
                background: i === 1 ? C.accentGlow : "transparent",
                borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
              }}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {comparison.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.6fr 1.3fr 1.3fr 1.3fr", borderBottom: i < comparison.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: C.text }}>{row.feature}</div>
              {[row.oneclick, row.metamask, row.biconomy, row.abstract].map((val, j) => (
                <div key={j} style={{
                  padding: "10px 16px", display: "flex", alignItems: "center",
                  borderLeft: `1px solid ${C.border}`,
                  color: j === 0 ? C.green : C.muted,
                  fontWeight: j === 0 ? 600 : 400,
                  background: j === 0 ? C.accentGlow : "transparent",
                }}><CellVal val={val}/></div>
              ))}
            </div>
          ))}
        </div>
        </div>
      </div>
    </Reveal>
  );
}

// ─── Block 5: SDK + Roadmap + Footer ────────────────────
function SDKRoadmapFooter() {
  const phases = [
    { label: "Q1 2026", title: "MVP", status: "done", color: C.green, items: "Wallet, 3 L1s, swaps, ICM, SDK, 39 tests" },
    { label: "Q2 2026", title: "RWA + AI", status: "now", color: C.accent, items: "RWA marketplace, fiat on-ramp, session keys, AI agent SDK" },
    { label: "Q3-Q4", title: "Scale", status: "planned", color: C.blue, items: "20+ L1s, MCP server, AI strategies, mobile SDK, compliance" },
    { label: "2027", title: "Mass Product", status: "planned", color: C.purple, items: "Enterprise WaaS, full fiat lifecycle, 1M+ wallets" },
  ];

  return (
    <Reveal>
      <div className="lp-section" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 24px" }}>
        {/* SDK */}
        <div className="lp-card lp-sdk-card" style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: "48px 40", textAlign: "center", position: "relative", overflow: "hidden", marginBottom: 48 }}>
          <div style={{ position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)", width: 400, height: 400, borderRadius: "50%", background: C.accentGlow, filter: "blur(80px)", pointerEvents: "none", opacity: 0.5 }}/>
          <div style={{ position: "relative" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>For Developers</p>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", margin: "0 0 8px" }}>5 lines of code. All L1s.</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>Replace MetaMask popups with fingerprint auth. 30 minutes to integrate.</p>

            <div className="lp-code" style={{
              background: "#090912", borderRadius: 14, border: `1px solid ${C.border}`, padding: 28,
              textAlign: "left", maxWidth: 540, margin: "0 auto",
              fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 13, lineHeight: 1.9,
              overflowX: "auto",
            }}>
              <div><span style={{ color: "#c678dd" }}>import</span> <span style={{ color: "#e5c07b" }}>{"{ connect }"}</span> <span style={{ color: "#c678dd" }}>from</span> <span style={{ color: "#98c379" }}>&quot;oneclick-wallet-sdk&quot;</span>;</div>
              <div style={{ height: 6 }}/>
              <div><span style={{ color: "#c678dd" }}>const</span> <span style={{ color: "#e06c75" }}>wallet</span> = <span style={{ color: "#c678dd" }}>await</span> <span style={{ color: "#61afef" }}>connect</span>({"{"} <span style={{ color: "#e06c75" }}>relayerUrl</span>: <span style={{ color: "#98c379" }}>&quot;...&quot;</span> {"}"});</div>
              <div style={{ color: C.dim }}>// User taps fingerprint — wallet ready</div>
              <div><span style={{ color: "#c678dd" }}>await</span> <span style={{ color: "#e06c75" }}>wallet</span>.<span style={{ color: "#61afef" }}>execute</span>({"{"} <span style={{ color: "#e06c75" }}>target</span>, <span style={{ color: "#e06c75" }}>data</span>, <span style={{ color: "#e06c75" }}>chainId</span>: <span style={{ color: "#d19a66" }}>43114</span> {"}"});</div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
              <a href="https://www.npmjs.com/package/oneclick-wallet-sdk" target="_blank" rel="noreferrer" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                npm install oneclick-wallet-sdk
              </a>
              <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noreferrer" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Roadmap</p>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>From hackathon to protocol</h2>
        </div>

        <div className="lp-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {phases.map((p, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 14, border: `1px solid ${p.status === "now" ? p.color + "35" : C.border}`, padding: "20px 18px", position: "relative", overflow: "hidden" }}>
              {p.status === "now" && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: p.color }}/>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: p.color, letterSpacing: "0.08em" }}>{p.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                  background: p.status === "done" ? C.green + "15" : p.status === "now" ? C.accent + "15" : C.dim + "15",
                  color: p.status === "done" ? C.green : p.status === "now" ? C.accent : C.dim,
                }}>{p.status === "done" ? "\u2713 Done" : p.status === "now" ? "Now" : "Planned"}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>{p.items}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="lp-footer" style={{ borderTop: `1px solid ${C.border}`, marginTop: 64, paddingTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: C.text }}>OneClick</span>
            <span style={{ fontSize: 12, color: C.dim, marginLeft: 6 }}>One Fingerprint. Every Asset.</span>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {[["GitHub", "https://github.com/YMprobot/Oneclick"], ["npm", "https://www.npmjs.com/package/oneclick-wallet-sdk"]].map(([l, h]) => (
              <a key={l} href={h} target="_blank" rel="noreferrer" style={{ color: C.muted, textDecoration: "none", fontSize: 12, fontWeight: 500 }}>{l}</a>
            ))}
            <Link href="/app" style={{ color: C.muted, textDecoration: "none", fontSize: 12, fontWeight: 500 }}>Demo</Link>
          </div>
          <div style={{ fontSize: 11, color: C.dim }}>Built for Avalanche Build Games 2026</div>
        </div>
      </div>
    </Reveal>
  );
}

// ─── Nav ────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(3,7,18,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(14px)" : "none",
      borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      transition: "all 0.3s" }}>
      <div className="lp-nav-inner" style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", color: C.text }}>OneClick</span>
        </div>
        <Link href="/app" className="lp-nav-btn" style={{
          background: C.accent, color: "#fff", padding: "7px 18px",
          borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          Launch App
        </Link>
      </div>
    </nav>
  );
}

// ─── App ────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh",
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <Nav/>
      <Hero/>
      <ProblemSolution/>
      <Verticals/>
      <HowAndCompare/>
      <SDKRoadmapFooter/>
    </div>
  );
}
