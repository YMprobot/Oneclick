'use client';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from "react";

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

// ─── Animated Counter ───────────────────────────────────
function AnimatedCounter({ value, suffix = "" }: { value: string; suffix?: string }) {
  const [ref, inView] = useInView(0.1);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return;
    // Check if value is purely numeric
    const num = parseInt(value, 10);
    if (isNaN(num) || value.includes("s") || value.includes("<") || value.includes("Tap")) {
      setDisplay(value);
      return;
    }
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOut: 1 - (1-t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (num - start) * eased);
      setDisplay(String(current));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, value]);

  return <span ref={ref}>{display}{suffix}</span>;
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

// ─── Phone Mockup ───────────────────────────────────────
function PhoneMockup() {
  return (
    <div style={{ animation: "phoneFloat 6s ease-in-out infinite", position: "relative" }}>
      {/* iPhone Frame */}
      <div style={{
        width: 280, height: 572, borderRadius: 44, border: "3px solid #2a2a35",
        background: C.bg, position: "relative", overflow: "hidden",
        boxShadow: `0 0 60px rgba(239,68,68,0.08), 0 20px 60px rgba(0,0,0,0.5)`,
      }}>
        {/* Dynamic Island */}
        <div style={{
          width: 100, height: 28, borderRadius: 14, background: "#000",
          position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
          zIndex: 10,
        }}/>

        {/* Screen Content */}
        <div style={{ padding: "52px 20px 0", height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Greeting */}
          <p style={{ fontSize: 12, color: C.muted, margin: "0 0 4px", fontWeight: 500 }}>Good morning</p>

          {/* Balance */}
          <div style={{ fontSize: 30, fontWeight: 700, color: C.text, margin: "0 0 8px", letterSpacing: "-0.02em" }}>$2,047.83</div>

          {/* Distribution Bar */}
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6, gap: 1 }}>
            <div style={{ width: "58%", background: C.accent, borderRadius: "3px 0 0 3px" }}/>
            <div style={{ width: "22%", background: C.green }}/>
            <div style={{ width: "16%", background: C.blue }}/>
            <div style={{ width: "4%", background: C.amber, borderRadius: "0 3px 3px 0" }}/>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {[["AVAX", C.accent, "58%"], ["USDT", C.green, "22%"], ["USDC", C.blue, "16%"], ["BEAM", C.amber, "4%"]].map(([name, color, pct]) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: color as string }}/>
                <span style={{ fontSize: 8, color: C.dim, fontWeight: 500 }}>{name} {pct}</span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{
              flex: 1, background: C.accent, borderRadius: 12, padding: "9px 0",
              textAlign: "center", fontSize: 12, fontWeight: 600, color: "#fff",
            }}>
              Send
            </div>
            <div style={{
              flex: 1, background: "#1f2937", borderRadius: 12, padding: "9px 0",
              textAlign: "center", fontSize: 12, fontWeight: 600, color: "#fff",
            }}>
              Receive
            </div>
            <div style={{
              flex: 1, background: "#1f2937", borderRadius: 12, padding: "9px 0",
              textAlign: "center", fontSize: 12, fontWeight: 600, color: "#fff",
            }}>
              Swap
            </div>
          </div>

          {/* Asset List */}
          <div style={{
            borderRadius: 16, border: "1px solid rgba(31,41,55,0.5)",
            background: "rgba(17,24,39,0.5)", padding: "10px 12px",
            marginBottom: 8, display: "flex", flexDirection: "column", gap: 0,
          }}>
            {[
              { sym: "AVAX", chain: "Avalanche C-Chain", amount: "52.40 AVAX", usd: "$1,196.32", color: C.accent, letter: "A" },
              { sym: "USDT", chain: "Avalanche C-Chain", amount: "438.50 USDT", usd: "$438.50", color: C.green, letter: "U" },
              { sym: "USDC", chain: "Avalanche C-Chain", amount: "326.80 USDC", usd: "$326.80", color: C.blue, letter: "U" },
              { sym: "BEAM", chain: "BEAM", amount: "12,500 BEAM", usd: "$86.21", color: C.amber, letter: "B" },
            ].map((a, i, arr) => (
              <div key={a.sym + i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                borderBottom: i < arr.length - 1 ? "1px solid rgba(31,41,55,0.3)" : "none",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", background: a.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>{a.letter}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{a.sym}</div>
                  <div style={{ fontSize: 8, color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.chain} · {a.amount}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, flexShrink: 0 }}>{a.usd}</div>
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }}/>

          {/* Bottom Nav */}
          <div style={{
            display: "flex", justifyContent: "space-around", alignItems: "center",
            padding: "12px 0 20px", borderTop: "1px solid rgba(31,41,55,0.5)",
          }}>
            {/* Home */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={C.accent} stroke="none">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/>
              </svg>
              <span style={{ fontSize: 9, color: C.accent, fontWeight: 600 }}>Home</span>
            </div>
            {/* Swap */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
              <span style={{ fontSize: 9, color: C.dim, fontWeight: 500 }}>Swap</span>
            </div>
            {/* Activity */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              <span style={{ fontSize: 9, color: C.dim, fontWeight: 500 }}>Activity</span>
            </div>
            {/* Log out */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              <span style={{ fontSize: 9, color: C.dim, fontWeight: 500 }}>Log out</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Floating Particles ─────────────────────────────────
function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 4,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 5,
    color: [C.accent, C.blue, C.purple, C.green, C.amber][i % 5],
    opacity: 0.15 + Math.random() * 0.25,
  }));

  return (
    <div className="lp-particles" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          width: p.size, height: p.size, borderRadius: "50%",
          background: p.color, opacity: p.opacity,
          left: `${p.x}%`, top: `${p.y}%`,
          animation: `particleDrift${p.id % 3} ${p.duration}s ease-in-out ${p.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

// ─── Block 1: Hero ──────────────────────────────────────
function Hero() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 24px 80px", position: "relative", overflow: "hidden" }}>
      {/* Floating Glow Orbs */}
      <div style={{
        position: "absolute", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 65%)`,
        pointerEvents: "none", animation: "orbDriftRed 15s ease-in-out infinite",
      }}/>
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 65%)`,
        pointerEvents: "none", animation: "orbDriftBlue 18s ease-in-out infinite",
      }}/>

      {/* Grid breathing */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(${C.muted} 1px, transparent 1px), linear-gradient(90deg, ${C.muted} 1px, transparent 1px)`,
        backgroundSize: "72px 72px", pointerEvents: "none",
        animation: "gridBreathe 4s ease-in-out infinite",
      }}/>

      {/* Floating particles */}
      <FloatingParticles />

      {/* Split Hero Layout */}
      <div className="lp-hero-split" style={{
        position: "relative", zIndex: 1, maxWidth: 1120, width: "100%",
        display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 48, alignItems: "center",
      }}>
        {/* Left: Text */}
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px",
            borderRadius: 100, background: C.accentGlow, border: `1px solid rgba(232,65,66,0.2)`,
            marginBottom: 28, fontSize: 12, fontWeight: 600, color: C.accentSoft, letterSpacing: "0.02em",
            opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s 0.15s cubic-bezier(.16,1,.3,1), transform 0.6s 0.15s cubic-bezier(.16,1,.3,1)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }}/>
            Avalanche Build Games 2026
          </div>

          <h1 style={{
            fontSize: "clamp(38px, 6.5vw, 72px)", fontWeight: 800, lineHeight: 1.06,
            letterSpacing: "-0.04em", color: C.text, margin: "0 0 20px",
            opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s 0.30s cubic-bezier(.16,1,.3,1), transform 0.6s 0.30s cubic-bezier(.16,1,.3,1)",
          }}>
            One Fingerprint.<br/>
            <span className="lp-glow-text" style={{ color: C.accent }}>Every Asset.</span>
          </h1>

          <p style={{
            fontSize: "clamp(15px, 2vw, 19px)", color: C.muted, lineHeight: 1.7,
            maxWidth: 560, margin: "0 0 36px",
            opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s 0.45s cubic-bezier(.16,1,.3,1), transform 0.6s 0.45s cubic-bezier(.16,1,.3,1)",
          }}>
            Smart wallet for Avalanche that replaces seed phrases with Face ID.
            Invest in real-world assets, trade tokens, play Web3 games, power AI agents — no crypto knowledge, no gas fees, no network switching.
          </p>

          <div style={{
            display: "flex", gap: 14, flexWrap: "wrap",
            opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s 0.60s cubic-bezier(.16,1,.3,1), transform 0.6s 0.60s cubic-bezier(.16,1,.3,1)",
          }}>
            <Link href="/app" className="lp-btn-try" style={{
              background: C.accent, color: "#fff", padding: "13px 28px", borderRadius: 10,
              textDecoration: "none", fontSize: 15, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 8,
              boxShadow: `0 6px 28px ${C.accentGlow}`,
              position: "relative", overflow: "hidden",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}>
              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 8 }}>Try Demo <Arrow/></span>
              <span className="lp-shimmer"/>
            </Link>
            <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noreferrer" className="lp-btn-doc" style={{
              background: "transparent", border: `1px solid ${C.border}`, color: C.text,
              padding: "13px 28px", borderRadius: 10, textDecoration: "none", fontSize: 15, fontWeight: 600,
              transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
            }}>
              Documentation
            </a>
            <Link href="/demo-game" className="lp-btn-doc" style={{
              background: "transparent", border: `1px solid ${C.purple}44`, color: C.purple,
              padding: "13px 28px", borderRadius: 10, textDecoration: "none", fontSize: 15, fontWeight: 600,
              transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
            }}>
              🎮 Demo Integration
            </Link>
          </div>

          <div className="lp-built-on" style={{
            display: "flex", alignItems: "center", gap: 0, marginTop: 56, flexWrap: "wrap",
            opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s 0.75s cubic-bezier(.16,1,.3,1), transform 0.6s 0.75s cubic-bezier(.16,1,.3,1)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em", marginRight: 20 }}>Built on</span>
            <span style={{ width: 1, height: 20, background: C.border, marginRight: 20 }}/>
            {[
              ["Avalanche", "rgba(239,68,68,0.55)"],
              ["Beam", "rgba(156,163,175,0.6)"],
              ["TraderJoe", "rgba(245,158,11,0.5)"],
              ["WebAuthn", "rgba(168,85,247,0.5)"],
              ["P256", "rgba(34,197,94,0.5)"],
            ].map(([name, color], i) => (
              <span key={i} style={{ fontSize: 13, fontWeight: 500, color: color as string, marginRight: 28, letterSpacing: "0.01em" }}>{name}</span>
            ))}
          </div>
        </div>

        {/* Right: Phone Mockup */}
        <div className="lp-hero-phone" style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)",
          transition: "opacity 0.8s 0.40s cubic-bezier(.16,1,.3,1), transform 0.8s 0.40s cubic-bezier(.16,1,.3,1)",
        }}>
          <PhoneMockup />
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes phoneFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes orbDriftRed{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,20px)}}
        @keyframes orbDriftBlue{0%,100%{transform:translate(0,0)}50%{transform:translate(-25px,-15px)}}
        @keyframes gridBreathe{0%,100%{opacity:0.025}50%{opacity:0.06}}
        @keyframes particleDrift0{0%,100%{transform:translate(0,0)}25%{transform:translate(15px,-20px)}50%{transform:translate(-10px,15px)}75%{transform:translate(20px,10px)}}
        @keyframes particleDrift1{0%,100%{transform:translate(0,0)}33%{transform:translate(-20px,10px)}66%{transform:translate(12px,-18px)}}
        @keyframes particleDrift2{0%,100%{transform:translate(0,0)}40%{transform:translate(18px,12px)}80%{transform:translate(-15px,-10px)}}
        @keyframes glowPulse{0%,100%{text-shadow:0 0 20px rgba(239,68,68,0.3), 0 0 40px rgba(239,68,68,0.1)}50%{text-shadow:0 0 30px rgba(239,68,68,0.5), 0 0 60px rgba(239,68,68,0.2)}}
        .lp-glow-text{animation:glowPulse 3s ease-in-out infinite;}
        @keyframes shimmerSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        .lp-shimmer{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);animation:shimmerSweep 3s ease-in-out infinite;}
        .lp-btn-try:hover{transform:translateY(-2px) scale(1.03) !important;box-shadow:0 8px 36px rgba(239,68,68,0.25) !important;}
        .lp-btn-doc:hover{transform:translateY(-2px) scale(1.03) !important;border-color:${C.borderHover} !important;box-shadow:0 4px 20px rgba(255,255,255,0.04) !important;}
        @keyframes tabFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .lp-tab-content{animation:tabFadeIn 0.3s ease-out;}
        .lp-step-card{transition:transform 0.25s ease, box-shadow 0.25s ease, border-color 0.3s;}
        .lp-step-card:hover{transform:translateY(-3px) !important;}
        .lp-roadmap-card{transition:transform 0.25s ease, box-shadow 0.25s ease, border-color 0.3s;}
        .lp-roadmap-card:hover{transform:translateY(-3px) !important;}
        .lp-table-row{transition:background 0.2s;}
        .lp-table-row:hover{background:${C.cardHover} !important;}
        .lp-particles{display:block;}
        @media(max-width:768px){
          .lp-hero-split{grid-template-columns:1fr !important; text-align:center;}
          .lp-hero-phone{display:none !important;}
          .lp-nav-inner{padding:12px 16px !important;}
          .lp-nav-btn{padding:7px 14px !important; font-size:12px !important;}
          .lp-section{padding:48px 16px !important;}
          .lp-grid-2{grid-template-columns:1fr !important;}
          .lp-grid-4{grid-template-columns:1fr 1fr !important;}
          .lp-card{padding:24px 18px !important;}
          .lp-heading{font-size:28px !important;}
          .lp-built-on{justify-content:center;}
          .lp-footer{flex-direction:column !important; align-items:flex-start !important; gap:12px !important;}
          .lp-code{padding:16px !important; font-size:11.5px !important;}
          .lp-sdk-card{padding:28px 18px !important;}
          .lp-table-wrap{margin:0 -16px; padding:0 16px;}
          .lp-scroll-hint{display:block !important; animation:lp-fade 2s ease-in-out infinite;}
          .lp-particles{display:none !important;}
        }
        @keyframes lp-fade{0%,100%{opacity:0.4}50%{opacity:1}}
        @media(max-width:480px){
          .lp-grid-4{grid-template-columns:1fr !important;}
        }
      `}</style>
    </div>
  );
}

// ─── Block 2: Problem -> Solution ────────────────────────
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
  const [tabKey, setTabKey] = useState(0);
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
        "ERC-8183 Commerce \u2014 trustless agent-to-agent transactions with task escrow and evaluator verification (roadmap)",
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

  const handleTabSwitch = useCallback((key: Vertical) => {
    setActive(key);
    setTabKey(prev => prev + 1);
  }, []);

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
            <button key={key} onClick={() => handleTabSwitch(key as Vertical)} style={{
              padding: "10px 28px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
              background: active === key ? val.color + "18" : "transparent",
              border: `1px solid ${active === key ? val.color + "40" : C.border}`,
              color: active === key ? val.color : C.muted,
              transition: "all 0.2s",
            }}>{val.label}</button>
          ))}
        </div>

        {/* Content */}
        <div key={tabKey} className="lp-tab-content lp-card" style={{ background: C.card, borderRadius: 20, border: `1px solid ${d.color}20`, padding: 40, position: "relative", overflow: "hidden" }}>
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
            <div key={i} className="lp-step-card" style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px 20px", textAlign: "center" }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = s.color + "40";
                e.currentTarget.style.boxShadow = `0 8px 30px ${s.color}15`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.boxShadow = "none";
              }}>
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
            <div key={i} className="lp-table-row" style={{ display: "grid", gridTemplateColumns: "2fr 1.6fr 1.3fr 1.3fr 1.3fr", borderBottom: i < comparison.length - 1 ? `1px solid ${C.border}` : "none" }}>
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
    { label: "Q2 2026", title: "RWA + AI", status: "now", color: C.accent, items: "RWA marketplace, fiat on-ramp, session keys, AI agent SDK, ERC-8183" },
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
            <div key={i} className="lp-roadmap-card" style={{ background: C.card, borderRadius: 14, border: `1px solid ${p.status === "now" ? p.color + "35" : C.border}`, padding: "20px 18px", position: "relative", overflow: "hidden" }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = p.color + "40";
                e.currentTarget.style.boxShadow = `0 8px 30px ${p.color}15`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = p.status === "now" ? p.color + "35" : C.border;
                e.currentTarget.style.boxShadow = "none";
              }}>
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
