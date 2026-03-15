'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { signIn, signChallenge } from '@/lib/webauthn';
import { RELAYER_URL } from '@/lib/constants';
import { truncateAddress, weiToAvax } from '@/lib/utils';

const G = {
  bg: "#0a0a1a",
  card: "#12122a",
  accent: "#8b5cf6",
  accentGlow: "rgba(139,92,246,0.15)",
  accentHover: "#7c3aed",
  gold: "#fbbf24",
  text: "#ffffff",
  muted: "#94a3b8",
  border: "#1e1b4b",
  success: "#22c55e",
};

const PAYMASTER = '0xFe1Dd7F4A8DbD7e9C92Eb7c79c9331E3f8cD494E';
const CHAIN_ID = 43113;
const BUY_VALUE = '1000000000000000'; // 0.001 AVAX

interface Item {
  name: string;
  gradient: string;
  icon: string;
}

const ITEMS: Item[] = [
  { name: 'Sword of Light', gradient: 'linear-gradient(135deg, #7c3aed, #c084fc)', icon: '⚔️' },
  { name: 'Shield of Dawn', gradient: 'linear-gradient(135deg, #2563eb, #60a5fa)', icon: '🛡️' },
  { name: 'Potion of Speed', gradient: 'linear-gradient(135deg, #059669, #34d399)', icon: '⚗️' },
];

export default function DemoGamePage() {
  const { wallet, hydrated, setWallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<number | null>(null);
  const [purchased, setPurchased] = useState<Record<number, string>>({});
  const [balance, setBalance] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) return;
    try {
      const res = await fetch(`${RELAYER_URL}/balance?walletAddress=${wallet.address}&chainId=${CHAIN_ID}`);
      if (res.ok) {
        const data: { chainId: number; balance: string }[] = await res.json();
        if (data.length > 0) {
          setBalance(weiToAvax(data[0].balance));
        }
      }
    } catch { /* ignore */ }
  }, [wallet?.address]);

  useEffect(() => {
    if (hydrated && wallet) fetchBalance();
  }, [hydrated, wallet, fetchBalance]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const passkey = await signIn();
      let address = '';
      try {
        const res = await fetch(`${RELAYER_URL}/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubKeyX: passkey.pubKeyX, pubKeyY: passkey.pubKeyY }),
        });
        if (res.ok) {
          const data = await res.json();
          address = data.walletAddress || '';
        }
      } catch { /* relayer unavailable */ }
      setWallet({
        address,
        pubKeyX: passkey.pubKeyX,
        pubKeyY: passkey.pubKeyY,
        credentialId: passkey.credentialId,
        isConnected: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy(index: number) {
    if (!wallet) return;
    setBuying(index);
    setError(null);
    try {
      // Prepare
      const prepRes = await fetch(`${RELAYER_URL}/prepare-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.address,
          target: PAYMASTER,
          value: BUY_VALUE,
          data: '0x',
          chainId: CHAIN_ID,
          pubKeyX: wallet.pubKeyX,
          pubKeyY: wallet.pubKeyY,
        }),
      });
      if (!prepRes.ok) {
        const body = await prepRes.json().catch(() => null);
        throw new Error(body?.error || `Relayer error (${prepRes.status})`);
      }
      const { challenge } = await prepRes.json();

      // Sign
      const cleanHex = challenge.startsWith('0x') ? challenge.slice(2) : challenge;
      const challengeBytes = new Uint8Array(
        cleanHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
      );
      const signature = await signChallenge(wallet.credentialId, challengeBytes);

      // Execute
      const execRes = await fetch(`${RELAYER_URL}/execute-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.address,
          target: PAYMASTER,
          value: BUY_VALUE,
          data: '0x',
          chainId: CHAIN_ID,
          pubKeyX: wallet.pubKeyX,
          pubKeyY: wallet.pubKeyY,
          signature: {
            r: signature.r,
            s: signature.s,
            authenticatorData: signature.authenticatorData,
            clientDataJSON: signature.clientDataJSON,
          },
        }),
      });
      if (!execRes.ok) {
        const body = await execRes.json().catch(() => null);
        throw new Error(body?.error || `Transaction failed (${execRes.status})`);
      }
      const result = await execRes.json();
      setPurchased((prev) => ({ ...prev, [index]: result.hash }));
      fetchBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setBuying(null);
    }
  }

  if (!hydrated) return null;

  const isConnected = wallet?.isConnected;

  return (
    <div style={{ minHeight: '100vh', background: G.bg, color: G.text, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: `1px solid ${G.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🎮</span>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>CryptoQuest</span>
          <span style={{ fontSize: 11, color: G.muted, background: G.card, padding: '2px 8px', borderRadius: 4, marginLeft: 4 }}>Demo Game</span>
        </div>
        {isConnected && wallet.address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
            {balance !== null && (
              <span style={{ color: G.gold, fontWeight: 600 }}>{balance} AVAX</span>
            )}
            <span style={{ color: G.muted, background: G.card, padding: '4px 12px', borderRadius: 6, border: `1px solid ${G.border}` }}>
              {truncateAddress(wallet.address)}
            </span>
          </div>
        )}
      </header>

      {!isConnected ? (
        /* ── Not logged in ── */
        <main style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 'calc(100vh - 65px)', padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚔️</div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.03em' }}>
            CryptoQuest
          </h1>
          <p style={{ fontSize: 18, color: G.muted, maxWidth: 420, marginBottom: 36, lineHeight: 1.6 }}>
            Collect legendary items. Trade with players. Own your loot.
          </p>
          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              background: G.accent, color: '#fff', border: 'none', padding: '16px 36px',
              borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              boxShadow: `0 8px 32px ${G.accentGlow}`, opacity: loading ? 0.7 : 1,
              transition: 'transform 0.2s, opacity 0.2s',
            }}
          >
            {loading ? 'Connecting...' : 'Play with Fingerprint 👆'}
          </button>
          {error && (
            <p style={{ color: '#ef4444', marginTop: 16, fontSize: 14 }}>{error}</p>
          )}
          <p style={{ color: G.muted, fontSize: 12, marginTop: 32, opacity: 0.6 }}>
            Powered by <span style={{ color: G.text, fontWeight: 600 }}>OneClick</span>
          </p>
        </main>
      ) : (
        /* ── Logged in ── */
        <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
              Welcome, Player!
            </h2>
            <p style={{ color: G.muted, fontSize: 14 }}>
              Browse the marketplace and collect items.
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 16px', marginBottom: 24, color: '#ef4444', fontSize: 14,
            }}>
              {error}
            </div>
          )}

          {/* NFT Items */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20, marginBottom: 48,
          }}>
            {ITEMS.map((item, i) => (
              <div key={i} style={{
                background: G.card, borderRadius: 16, border: `1px solid ${G.border}`,
                overflow: 'hidden', transition: 'transform 0.2s, border-color 0.2s',
              }}>
                {/* Item image placeholder */}
                <div style={{
                  background: item.gradient, height: 160,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
                }}>
                  {item.icon}
                </div>
                <div style={{ padding: '16px 20px 20px' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{item.name}</h3>
                  <p style={{ color: G.gold, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>0.001 AVAX</p>

                  {purchased[i] ? (
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: G.success }}>✅ Purchased!</span>
                      <br />
                      <span style={{ color: G.muted, fontSize: 12 }}>
                        Tx: {truncateAddress(purchased[i])}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuy(i)}
                      disabled={buying !== null}
                      style={{
                        width: '100%', background: buying === i ? G.accentHover : G.accent,
                        color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8,
                        fontSize: 14, fontWeight: 600, cursor: buying !== null ? 'wait' : 'pointer',
                        opacity: buying !== null && buying !== i ? 0.5 : 1,
                        transition: 'background 0.2s, opacity 0.2s',
                      }}
                    >
                      {buying === i ? 'Confirming...' : 'Buy for 0.001 AVAX'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Integration Code */}
          <div style={{
            background: G.card, borderRadius: 16, border: `1px solid ${G.border}`,
            padding: '24px 28px', marginBottom: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>🔌</span>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Integration Code</h3>
              <span style={{ fontSize: 12, color: G.muted, marginLeft: 'auto' }}>npm i oneclick-wallet-sdk</span>
            </div>
            <pre style={{
              background: '#080818', borderRadius: 10, padding: '20px 24px',
              fontSize: 13, lineHeight: 1.7, overflowX: 'auto', color: '#e2e8f0',
              border: `1px solid ${G.border}`, margin: 0,
            }}>
{`import { signIn, signChallenge } from 'oneclick-wallet-sdk';

// 1. Connect — user taps fingerprint, no MetaMask popup
const wallet = await signIn();
// => { credentialId, pubKeyX, pubKeyY }

// 2. Deploy wallet (relayer handles gas)
const res = await fetch(RELAYER_URL + '/deploy', {
  method: 'POST',
  body: JSON.stringify({
    pubKeyX: wallet.pubKeyX,
    pubKeyY: wallet.pubKeyY,
  }),
});
const { walletAddress } = await res.json();

// 3. Send transaction — user confirms with Face ID
const { challenge } = await prepareTransaction({
  walletAddress, target, value, chainId,
});
const signature = await signChallenge(
  wallet.credentialId, challenge
);
await executeTransaction({ walletAddress, signature });

// That's it. No seed phrase. No gas config.
// No network switching. Just fingerprint.`}
            </pre>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link href="/" style={{
              color: G.muted, fontSize: 14, textDecoration: 'none',
              transition: 'color 0.2s',
            }}>
              ← Back to OneClick
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}
