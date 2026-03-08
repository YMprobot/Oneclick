'use client';

import Link from 'next/link';

const C = {
  bg: '#030712',       // matches gray-950 from Tailwind
  card: '#111827',     // matches gray-900
  border: '#1f2937',   // matches gray-800
  accent: '#ef4444',   // matches red-500 used in app buttons
  accentHover: '#dc2626',
  text: '#ffffff',
  muted: '#9ca3af',    // gray-400
  dimmed: '#6b7280',   // gray-500
};

export default function LandingPage() {
  return (
    <>
      <style>{`
        .landing * { box-sizing: border-box; }
        .landing { font-family: inherit; }
        .landing-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        .landing-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .landing-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        @media (max-width: 1023px) {
          .landing-grid-4 { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .landing-grid-4 { grid-template-columns: 1fr; }
          .landing-grid-3 { grid-template-columns: 1fr; }
          .landing-grid-2 { grid-template-columns: 1fr; }
          .landing-hero-title { font-size: 2.5rem !important; }
          .landing-nav-links { display: none !important; }
          .landing-footer-grid { grid-template-columns: 1fr !important; text-align: center; }
          .landing-hero-buttons { flex-direction: column; }
        }
      `}</style>

      <div className="landing" style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
        {/* Nav */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: `${C.bg}ee`, backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            maxWidth: 1200, margin: '0 auto', padding: '16px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
              OneClick
            </span>
            <div className="landing-nav-links" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <a href="#features" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Features</a>
              <a href="#how-it-works" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>How It Works</a>
              <a href="#security" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Security</a>
              <a href="#sdk" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>SDK</a>
              <Link href="/app" style={{
                background: C.accent, color: '#fff', padding: '10px 24px',
                borderRadius: 12, fontSize: 14, fontWeight: 600,
                textDecoration: 'none', transition: 'background 0.2s',
              }}>
                Launch App
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section style={{
          maxWidth: 1200, margin: '0 auto', padding: '120px 24px 80px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 999,
            background: `${C.accent}15`, border: `1px solid ${C.accent}30`,
            fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 24,
          }}>
            Built for Avalanche L1s
          </div>
          <h1 className="landing-hero-title" style={{
            fontSize: '4rem', fontWeight: 800, lineHeight: 1.1,
            letterSpacing: '-0.03em', marginBottom: 24,
          }}>
            One Fingerprint.<br />
            <span style={{ color: C.accent }}>Every Chain.</span>
          </h1>
          <p style={{
            fontSize: 20, color: C.muted, maxWidth: 600,
            margin: '0 auto 48px', lineHeight: 1.6,
          }}>
            Smart wallet with passkey authentication. No seed phrases, no gas fees,
            no network switching. Just your fingerprint.
          </p>
          <div className="landing-hero-buttons" style={{
            display: 'flex', gap: 16, justifyContent: 'center',
          }}>
            <Link href="/app" style={{
              background: C.accent, color: '#fff', padding: '16px 40px',
              borderRadius: 14, fontSize: 18, fontWeight: 700,
              textDecoration: 'none', transition: 'background 0.2s',
            }}>
              Try Demo
            </Link>
            <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noopener noreferrer" style={{
              background: 'transparent', color: C.text,
              padding: '16px 40px', borderRadius: 14, fontSize: 18,
              fontWeight: 700, textDecoration: 'none',
              border: `1px solid ${C.border}`, transition: 'border-color 0.2s',
            }}>
              Documentation
            </a>
          </div>
        </section>

        {/* Features */}
        <section id="features" style={{
          maxWidth: 1200, margin: '0 auto', padding: '80px 24px',
        }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Why OneClick?
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 64, fontSize: 18 }}>
            Everything a wallet should be. Nothing it shouldn&apos;t.
          </p>
          <div className="landing-grid-4">
            {[
              {
                icon: '\uD83D\uDD10',
                title: 'Passkey Auth',
                desc: 'FaceID / TouchID login. No seed phrases, no browser extensions. Your biometrics are your keys.',
              },
              {
                icon: '\u26D3\uFE0F',
                title: 'Multi-Chain',
                desc: 'One wallet address across every Avalanche L1. Same fingerprint works everywhere.',
              },
              {
                icon: '\u26FD',
                title: 'Gasless',
                desc: 'Paymaster sponsors gas fees. Users never need to hold native tokens just to transact.',
              },
              {
                icon: '\uD83D\uDD04',
                title: 'Smart Routing',
                desc: 'Send any token on any chain. OneClick automatically swaps and bridges behind the scenes.',
              },
            ].map((f) => (
              <div key={f.title} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 32,
              }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" style={{
          maxWidth: 1200, margin: '0 auto', padding: '80px 24px',
        }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            How It Works
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 64, fontSize: 18 }}>
            Three steps. Zero complexity.
          </p>
          <div className="landing-grid-3">
            {[
              {
                step: '01',
                title: 'Create Wallet',
                desc: 'Tap "Create Wallet" and scan your fingerprint. A P256 key pair is generated in your device\'s secure enclave. That\'s it.',
              },
              {
                step: '02',
                title: 'Send & Swap',
                desc: 'Enter an address and amount. OneClick finds the best route, handles gas, and executes. You just confirm with your fingerprint.',
              },
              {
                step: '03',
                title: 'Works Everywhere',
                desc: 'Same wallet on every Avalanche L1. No network switching. No bridging UX. Your address follows you.',
              },
            ].map((s) => (
              <div key={s.step} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 32, position: 'relative',
              }}>
                <div style={{
                  fontSize: 64, fontWeight: 900, color: `${C.accent}15`,
                  position: 'absolute', top: 16, right: 24, lineHeight: 1,
                }}>
                  {s.step}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{s.title}</h3>
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section id="security" style={{
          maxWidth: 1200, margin: '0 auto', padding: '80px 24px',
        }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Your keys. Your device. Period.
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 64, fontSize: 18 }}>
            OneClick is fully non-custodial. We never touch your private keys.
          </p>
          <div className="landing-grid-3">
            {[
              {
                icon: '\uD83D\uDEE1\uFE0F',
                title: 'Secure Enclave',
                desc: 'P256 keys generated and stored in your device\u2019s secure hardware. Same chip that protects Apple Pay and Face ID. Physically impossible to extract.',
              },
              {
                icon: '\u26D3\uFE0F',
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
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <p style={{
            textAlign: 'center', color: C.dimmed, marginTop: 48, fontSize: 14,
          }}>
            Security audit completed. Contracts verified on Snowtrace.{' '}
            <a
              href="https://github.com/YMprobot/Oneclick"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.accent, textDecoration: 'none' }}
            >
              Open source on GitHub.
            </a>
          </p>
        </section>

        {/* SDK */}
        <section id="sdk" style={{
          maxWidth: 1200, margin: '0 auto', padding: '80px 24px',
        }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Integrate in Minutes
          </h2>
          <p style={{ textAlign: 'center', color: C.muted, marginBottom: 48, fontSize: 18 }}>
            Add OneClick to your dApp with a few lines of code.
          </p>
          <div style={{
            maxWidth: 700, margin: '0 auto', background: C.card,
            border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: C.dimmed }}>Terminal</span>
              <a
                href="https://www.npmjs.com/package/oneclick-wallet-sdk"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}
              >
                npm &rarr;
              </a>
            </div>
            <pre style={{
              padding: 24, margin: 0, fontSize: 14,
              color: C.muted, overflowX: 'auto', lineHeight: 1.8,
            }}>
              <code>
{`$ npm install oneclick-wallet-sdk

import { OneClick } from 'oneclick-wallet-sdk';

const wallet = new OneClick();
await wallet.connect();          // FaceID prompt
await wallet.execute({
  to: '0x...',
  value: '1000000000000000000', // 1 AVAX
  chainId: 43114,
});`}
              </code>
            </pre>
          </div>
        </section>

        {/* CTA */}
        <section style={{
          maxWidth: 800, margin: '0 auto', padding: '80px 24px', textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Ready to ditch seed phrases?
          </h2>
          <p style={{ color: C.muted, marginBottom: 40, fontSize: 18 }}>
            Try the demo. Create a wallet in seconds.
          </p>
          <Link href="/app" style={{
            display: 'inline-block', background: C.accent, color: '#fff',
            padding: '18px 48px', borderRadius: 14, fontSize: 18,
            fontWeight: 700, textDecoration: 'none',
          }}>
            Launch App
          </Link>
        </section>

        {/* Footer */}
        <footer style={{
          borderTop: `1px solid ${C.border}`, padding: '48px 24px',
          maxWidth: 1200, margin: '0 auto',
        }}>
          <div className="landing-footer-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 48,
            alignItems: 'start',
          }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 800 }}>OneClick</span>
              <p style={{ color: C.dimmed, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                Universal smart wallet for Avalanche L1s.<br />
                Built for Avalanche Build Games 2026.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Product</span>
              <Link href="/app" style={{ color: C.dimmed, fontSize: 13, textDecoration: 'none' }}>
                Demo
              </Link>
              <a href="https://www.npmjs.com/package/oneclick-wallet-sdk" target="_blank" rel="noopener noreferrer"
                style={{ color: C.dimmed, fontSize: 13, textDecoration: 'none' }}>
                SDK
              </a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Links</span>
              <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noopener noreferrer"
                style={{ color: C.dimmed, fontSize: 13, textDecoration: 'none' }}>
                GitHub
              </a>
              <a href="https://github.com/YMprobot/Oneclick" target="_blank" rel="noopener noreferrer"
                style={{ color: C.dimmed, fontSize: 13, textDecoration: 'none' }}>
                Documentation
              </a>
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
