'use client';

import Link from 'next/link';

const C = {
  bg: '#07070d',
  card: '#0f0f1a',
  cardAlt: '#141422',
  border: '#1a1a2e',
  accent: '#e84142',
  accentGlow: 'rgba(232, 65, 66, 0.15)',
  green: '#34d399',
  text: '#ffffff',
  muted: '#9ca3af',
  dimmed: '#6b7280',
};

export default function LandingPage() {
  return (
    <>
      <style>{`
        .lp * { box-sizing: border-box; margin: 0; padding: 0; }
        .lp { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .lp a { transition: opacity 0.2s; }
        .lp a:hover { opacity: 0.85; }
        .lp-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .lp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .lp-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        .lp-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        .lp-table { width: 100%; border-collapse: collapse; }
        .lp-table th, .lp-table td { padding: 14px 20px; text-align: left; border-bottom: 1px solid ${C.border}; font-size: 14px; }
        .lp-table th { color: ${C.dimmed}; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
        .lp-table td:first-child { font-weight: 600; color: ${C.text}; }
        .lp-table td { color: ${C.muted}; }
        .lp-check { color: ${C.green}; font-weight: 700; }
        .lp-cross { color: ${C.dimmed}; }
        .lp-highlight-col { background: rgba(232, 65, 66, 0.05); }
        @media (max-width: 1023px) {
          .lp-grid-4, .lp-steps { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .lp-grid-4, .lp-grid-3, .lp-grid-2, .lp-steps { grid-template-columns: 1fr; }
          .lp-hero-title { font-size: 2.5rem !important; line-height: 1.15 !important; }
          .lp-nav-links { display: none !important; }
          .lp-hero-btns { flex-direction: column; align-items: stretch; }
          .lp-footer-grid { grid-template-columns: 1fr !important; text-align: center; gap: 32px !important; }
          .lp-problem-grid { grid-template-columns: 1fr !important; }
          .lp-table-wrap { overflow-x: auto; }
          .lp-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div className="lp" style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>

        {/* ── Nav ── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: `${C.bg}ee`, backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            maxWidth: 1140, margin: '0 auto', padding: '14px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
              OneClick
            </span>
            <div className="lp-nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
              <a href="#features" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Features</a>
              <a href="#how-it-works" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>How It Works</a>
              <a href="#security" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Security</a>
              <a href="#compare" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Compare</a>
              <a href="#sdk" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>SDK</a>
              <Link href="/app" style={{
                background: C.accent, color: '#fff', padding: '10px 24px',
                borderRadius: 12, fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
              }}>
                Launch App
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section style={{ maxWidth: 1140, margin: '0 auto', padding: '100px 24px 60px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 999,
            background: C.accentGlow, border: `1px solid rgba(232,65,66,0.25)`,
            fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 28,
          }}>
            Built for Avalanche L1s
          </div>
          <h1 className="lp-hero-title" style={{
            fontSize: '4rem', fontWeight: 800, lineHeight: 1.08,
            letterSpacing: '-0.03em', marginBottom: 20,
          }}>
            One Fingerprint.<br />
            <span style={{ color: C.accent }}>Every Chain.</span>
          </h1>
          <p style={{
            fontSize: 19, color: C.muted, maxWidth: 560,
            margin: '0 auto 44px', lineHeight: 1.6,
          }}>
            The smart wallet that replaces seed phrases with biometrics.
            No gas fees. No network switching. Just your fingerprint.
          </p>
          <div className="lp-hero-btns" style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <Link href="/app" style={{
              background: C.accent, color: '#fff', padding: '16px 40px',
              borderRadius: 14, fontSize: 17, fontWeight: 700,
              textDecoration: 'none',
            }}>
              Try Demo
            </Link>
            <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noopener noreferrer" style={{
              background: 'transparent', color: C.text,
              padding: '16px 40px', borderRadius: 14, fontSize: 17,
              fontWeight: 700, textDecoration: 'none',
              border: `1px solid ${C.border}`,
            }}>
              Documentation
            </a>
          </div>
        </section>

        {/* ── Stats ── */}
        <section style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>
          <div className="lp-stats" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20,
          }}>
            {[
              { value: '3', label: 'Blockchains' },
              { value: '0', label: 'Seed Phrases' },
              { value: '1 Tap', label: 'To Transact' },
              { value: '<2s', label: 'Transaction' },
            ].map((s) => (
              <div key={s.label} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '28px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: C.accent, marginBottom: 6 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Problem vs Solution ── */}
        <section id="features" style={{ maxWidth: 1140, margin: '0 auto', padding: '60px 24px 80px' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Why OneClick?
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 56, fontSize: 17 }}>
            Crypto wallets are broken. We fixed them.
          </p>
          <div className="lp-problem-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {/* Problem */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: 32,
            }}>
              <div style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,0.1)', color: '#f87171',
                fontSize: 12, fontWeight: 700, marginBottom: 20,
              }}>
                PROBLEM
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
                7 steps with MetaMask
              </h3>
              <ol style={{ color: C.muted, fontSize: 14, lineHeight: 2, paddingLeft: 20 }}>
                <li>Install browser extension</li>
                <li>Write down 12-word seed phrase</li>
                <li>Add custom network RPC</li>
                <li>Get native token for gas</li>
                <li>Approve token spending</li>
                <li>Confirm gas fee popup</li>
                <li>Sign transaction</li>
              </ol>
            </div>
            {/* Solution */}
            <div style={{
              background: C.card, border: `1px solid ${C.accent}30`,
              borderRadius: 16, padding: 32,
              boxShadow: `0 0 40px ${C.accentGlow}`,
            }}>
              <div style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 8,
                background: C.accentGlow, color: C.accent,
                fontSize: 12, fontWeight: 700, marginBottom: 20,
              }}>
                SOLUTION
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
                1 step with OneClick
              </h3>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: `${C.accent}10`, borderRadius: 12, padding: '20px 24px',
                marginBottom: 20,
              }}>
                <span style={{ fontSize: 36 }}>{'\uD83D\uDD90\uFE0F'}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Tap your fingerprint</div>
                  <div style={{ color: C.muted, fontSize: 14 }}>That&apos;s it. Wallet created, transaction signed, gas paid.</div>
                </div>
              </div>
              <ul style={{ color: C.muted, fontSize: 14, lineHeight: 2, listStyle: 'none', padding: 0 }}>
                <li style={{ color: C.green }}>&#10003; No extension to install</li>
                <li style={{ color: C.green }}>&#10003; No seed phrase to lose</li>
                <li style={{ color: C.green }}>&#10003; No gas tokens needed</li>
                <li style={{ color: C.green }}>&#10003; No network switching</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" style={{ maxWidth: 1140, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            How It Works
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 56, fontSize: 17 }}>
            Four steps. Zero complexity.
          </p>
          <div className="lp-steps">
            {[
              { num: '01', icon: '\uD83D\uDCF1', title: 'Open App', desc: 'Visit the app in any browser. No downloads, no extensions. Works on mobile and desktop.' },
              { num: '02', icon: '\uD83D\uDD90\uFE0F', title: 'Tap Finger', desc: 'FaceID or TouchID creates a P256 key pair in your device\'s secure enclave. Your wallet is born.' },
              { num: '03', icon: '\uD83D\uDCB0', title: 'Fund Wallet', desc: 'Send any token to your address. Same address works on every Avalanche L1 chain automatically.' },
              { num: '04', icon: '\u26A1', title: 'Transact', desc: 'Send, swap, or interact with dApps. Confirm with fingerprint. Gas is sponsored. Done.' },
            ].map((s) => (
              <div key={s.num} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 28, position: 'relative',
              }}>
                <div style={{
                  fontSize: 56, fontWeight: 900, color: `${C.accent}12`,
                  position: 'absolute', top: 12, right: 20, lineHeight: 1,
                }}>
                  {s.num}
                </div>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{s.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security ── */}
        <section id="security" style={{ maxWidth: 1140, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Your keys. Your device. Period.
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 56, fontSize: 17 }}>
            OneClick is fully non-custodial. We never touch your private keys.
          </p>
          <div className="lp-grid-3">
            {[
              {
                icon: '\uD83D\uDEE1\uFE0F',
                title: 'Secure Enclave',
                desc: 'P256 keys generated and stored in your device\u2019s secure hardware. Same chip that protects Apple Pay and Face ID. Physically impossible to extract.',
              },
              {
                icon: '\u2693',
                title: 'On-chain Verification',
                desc: 'Every transaction verified on-chain via the secp256r1 precompile (Granite upgrade). The blockchain itself checks your fingerprint signature. No trusted middleman.',
              },
              {
                icon: '\uD83D\uDEAB',
                title: 'No Seed Phrase',
                desc: 'Nothing to write down, screenshot, or lose. No 12 words. No private key export. If someone steals your laptop, they still can\u2019t sign without your fingerprint.',
              },
            ].map((s) => (
              <div key={s.title} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 32,
              }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{s.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: C.dimmed, marginTop: 40, fontSize: 14 }}>
            Security audit completed. Contracts verified on Snowtrace.{' '}
            <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noopener noreferrer"
              style={{ color: C.accent, textDecoration: 'none' }}>
              Open source on GitHub.
            </a>
          </p>
        </section>

        {/* ── Comparison Table ── */}
        <section id="compare" style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            How We Compare
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 48, fontSize: 17 }}>
            OneClick vs the competition.
          </p>
          <div className="lp-table-wrap" style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, overflow: 'hidden',
          }}>
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="lp-highlight-col">OneClick</th>
                  <th>MetaMask</th>
                  <th>Biconomy</th>
                  <th>Abstract</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Passkey / Biometric Login', oneclick: true, metamask: false, biconomy: true, abstract: true },
                  { feature: 'No Seed Phrase', oneclick: true, metamask: false, biconomy: false, abstract: true },
                  { feature: 'Gasless Transactions', oneclick: true, metamask: false, biconomy: true, abstract: true },
                  { feature: 'Multi-chain Same Address', oneclick: true, metamask: false, biconomy: false, abstract: false },
                  { feature: 'No Browser Extension', oneclick: true, metamask: false, biconomy: true, abstract: true },
                  { feature: 'Smart Routing / Auto-swap', oneclick: true, metamask: false, biconomy: false, abstract: false },
                  { feature: 'Avalanche L1 Native', oneclick: true, metamask: false, biconomy: false, abstract: false },
                  { feature: 'Open Source', oneclick: true, metamask: true, biconomy: true, abstract: false },
                ].map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td className="lp-highlight-col">
                      <span className="lp-check">&#10003;</span>
                    </td>
                    <td>{row.metamask
                      ? <span className="lp-check">&#10003;</span>
                      : <span className="lp-cross">&#10007;</span>}
                    </td>
                    <td>{row.biconomy
                      ? <span className="lp-check">&#10003;</span>
                      : <span className="lp-cross">&#10007;</span>}
                    </td>
                    <td>{row.abstract
                      ? <span className="lp-check">&#10003;</span>
                      : <span className="lp-cross">&#10007;</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SDK ── */}
        <section id="sdk" style={{ maxWidth: 1140, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Integrate in Minutes
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 48, fontSize: 17 }}>
            Add OneClick to your dApp with a few lines of code.
          </p>
          <div style={{
            maxWidth: 680, margin: '0 auto', background: C.card,
            border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: C.dimmed, fontFamily: 'monospace' }}>Terminal</span>
              <a href="https://www.npmjs.com/package/oneclick-wallet-sdk"
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 600 }}>
                View on npm &rarr;
              </a>
            </div>
            <pre style={{
              padding: 24, margin: 0, fontSize: 13, fontFamily: 'monospace',
              color: C.muted, overflowX: 'auto', lineHeight: 1.9,
            }}>
              <code>{`$ npm install oneclick-wallet-sdk

import { OneClick } from 'oneclick-wallet-sdk';

const wallet = new OneClick();
await wallet.connect();          // FaceID prompt
await wallet.execute({
  to: '0x...',
  value: '1000000000000000000', // 1 AVAX
  chainId: 43114,
});`}</code>
            </pre>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px 100px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Ready to ditch seed phrases?
          </h2>
          <p style={{ color: C.muted, marginBottom: 40, fontSize: 17 }}>
            Try the demo. Create a wallet in seconds with just your fingerprint.
          </p>
          <Link href="/app" style={{
            display: 'inline-block', background: C.accent, color: '#fff',
            padding: '18px 48px', borderRadius: 14, fontSize: 18,
            fontWeight: 700, textDecoration: 'none',
          }}>
            Launch App
          </Link>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: `1px solid ${C.border}`, padding: '48px 24px', maxWidth: 1140, margin: '0 auto' }}>
          <div className="lp-footer-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 48, alignItems: 'start',
          }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 800 }}>OneClick</span>
              <p style={{ color: C.dimmed, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                Universal smart wallet for Avalanche L1s.<br />
                Built for Avalanche Build Games 2026.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.dimmed, marginBottom: 2 }}>Product</span>
              <Link href="/app" style={{ color: C.muted, fontSize: 13, textDecoration: 'none' }}>Demo</Link>
              <a href="https://www.npmjs.com/package/oneclick-wallet-sdk" target="_blank" rel="noopener noreferrer"
                style={{ color: C.muted, fontSize: 13, textDecoration: 'none' }}>SDK</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.dimmed, marginBottom: 2 }}>Links</span>
              <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noopener noreferrer"
                style={{ color: C.muted, fontSize: 13, textDecoration: 'none' }}>GitHub</a>
              <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noopener noreferrer"
                style={{ color: C.muted, fontSize: 13, textDecoration: 'none' }}>Documentation</a>
            </div>
          </div>
          <div style={{
            borderTop: `1px solid ${C.border}`, marginTop: 32, paddingTop: 24,
            textAlign: 'center', color: C.dimmed, fontSize: 12,
          }}>
            &copy; 2026 OneClick. Open source under MIT License.
          </div>
        </footer>
      </div>
    </>
  );
}
