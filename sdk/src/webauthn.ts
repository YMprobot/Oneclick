import type { PasskeyCredential, SignatureData } from './types.js';

// ============================================================
// Base64url helpers
// ============================================================

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================
// Hex helpers
// ============================================================

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ============================================================
// Minimal CBOR decoder
// Handles: unsigned int, negative int, byte string, text string,
//          arrays, maps — the subset needed for WebAuthn parsing.
// ============================================================

interface CborDecodeResult {
  value: unknown;
  offset: number;
}

function cborDecodeItem(data: Uint8Array, offset: number): CborDecodeResult {
  if (offset >= data.length) {
    throw new Error('CBOR: unexpected end of data');
  }

  const initialByte = data[offset];
  const majorType = initialByte >> 5;
  const additionalInfo = initialByte & 0x1f;
  offset++;

  // Read argument value
  let argValue: number;
  if (additionalInfo < 24) {
    argValue = additionalInfo;
  } else if (additionalInfo === 24) {
    argValue = data[offset];
    offset++;
  } else if (additionalInfo === 25) {
    argValue = (data[offset] << 8) | data[offset + 1];
    offset += 2;
  } else if (additionalInfo === 26) {
    argValue =
      (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3];
    argValue = argValue >>> 0; // unsigned
    offset += 4;
  } else {
    throw new Error(`CBOR: unsupported additional info ${additionalInfo}`);
  }

  switch (majorType) {
    // Major type 0: unsigned integer
    case 0:
      return { value: argValue, offset };

    // Major type 1: negative integer
    case 1:
      return { value: -1 - argValue, offset };

    // Major type 2: byte string
    case 2: {
      const bytes = data.slice(offset, offset + argValue);
      return { value: bytes, offset: offset + argValue };
    }

    // Major type 3: text string
    case 3: {
      const textBytes = data.slice(offset, offset + argValue);
      const text = new TextDecoder().decode(textBytes);
      return { value: text, offset: offset + argValue };
    }

    // Major type 4: array
    case 4: {
      const arr: unknown[] = [];
      let pos = offset;
      for (let i = 0; i < argValue; i++) {
        const item = cborDecodeItem(data, pos);
        arr.push(item.value);
        pos = item.offset;
      }
      return { value: arr, offset: pos };
    }

    // Major type 5: map
    case 5: {
      const map = new Map<unknown, unknown>();
      let pos = offset;
      for (let i = 0; i < argValue; i++) {
        const keyResult = cborDecodeItem(data, pos);
        pos = keyResult.offset;
        const valResult = cborDecodeItem(data, pos);
        pos = valResult.offset;
        map.set(keyResult.value, valResult.value);
      }
      return { value: map, offset: pos };
    }

    default:
      throw new Error(`CBOR: unsupported major type ${majorType}`);
  }
}

function parseCBOR(data: Uint8Array): unknown {
  const result = cborDecodeItem(data, 0);
  return result.value;
}

// ============================================================
// DER signature parser
// DER format: 0x30 [total-len] 0x02 [r-len] [r] 0x02 [s-len] [s]
// ============================================================

function parseDERSignature(sig: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  let offset = 0;

  // SEQUENCE tag
  if (sig[offset] !== 0x30) {
    throw new Error('DER: expected SEQUENCE tag 0x30');
  }
  offset++;

  // Total length (skip, we parse by structure)
  const totalLen = sig[offset];
  offset++;
  // Handle long form length encoding
  if (totalLen & 0x80) {
    const lenBytes = totalLen & 0x7f;
    offset += lenBytes; // skip extended length bytes
  }

  // Parse r
  if (sig[offset] !== 0x02) {
    throw new Error('DER: expected INTEGER tag 0x02 for r');
  }
  offset++;
  const rLen = sig[offset];
  offset++;
  const rBytes = new Uint8Array(sig.slice(offset, offset + rLen));
  offset += rLen;

  // Parse s
  if (sig[offset] !== 0x02) {
    throw new Error('DER: expected INTEGER tag 0x02 for s');
  }
  offset++;
  const sLen = sig[offset];
  offset++;
  const sBytes = new Uint8Array(sig.slice(offset, offset + sLen));

  // Normalize r and s to exactly 32 bytes
  const r = normalizeInteger(rBytes, 32);
  const s = normalizeInteger(sBytes, 32);

  return { r, s };
}

/**
 * Normalize a DER integer to exactly `length` bytes.
 * - Trims leading zero padding (DER adds 0x00 prefix for positive numbers with high bit set)
 * - Left-pads with zeros if shorter than target length
 */
function normalizeInteger(bytes: Uint8Array, length: number): Uint8Array {
  // Strip leading zeros
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0x00) {
    start++;
  }
  const trimmed = bytes.slice(start);

  if (trimmed.length === length) {
    return trimmed;
  }

  if (trimmed.length > length) {
    // Should not happen with valid P-256, but handle gracefully
    return trimmed.slice(trimmed.length - length);
  }

  // Pad left with zeros
  const padded = new Uint8Array(length);
  padded.set(trimmed, length - trimmed.length);
  return padded;
}

// ============================================================
// Public API
// ============================================================

/**
 * Create a new passkey (platform authenticator) and extract the P-256 public key.
 * Uses WebAuthn navigator.credentials.create() with ES256 (alg -7).
 */
export async function createPasskey(username: string): Promise<PasskeyCredential> {
  // Generate random user ID
  const userId = new Uint8Array(32);
  crypto.getRandomValues(userId);

  const createOptions: PublicKeyCredentialCreationOptions = {
    rp: {
      name: 'OneClick Wallet',
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: username,
      displayName: username,
    },
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256 (P-256) — what we need
      { alg: -257, type: 'public-key' },  // RS256 — fallback for compatibility
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
    attestation: 'none',
  };

  const credential = (await navigator.credentials.create({
    publicKey: createOptions,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey creation was cancelled or failed');
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const attestationObject = new Uint8Array(response.attestationObject);

  // Parse CBOR attestation object to get authData
  const attestation = parseCBOR(attestationObject) as Map<unknown, unknown>;
  const authData = attestation.get('authData') as Uint8Array;

  if (!authData) {
    throw new Error('No authData in attestation object');
  }

  // Parse authData:
  //   rpIdHash:          32 bytes
  //   flags:              1 byte
  //   signCount:          4 bytes
  //   attestedCredData:   variable (present when flags bit 6 is set)
  //     aaguid:          16 bytes
  //     credIdLen:        2 bytes (big-endian)
  //     credId:           credIdLen bytes
  //     credPubKey:       CBOR-encoded COSE key
  let offset = 37; // skip rpIdHash(32) + flags(1) + signCount(4)

  // AAGUID (16 bytes)
  offset += 16;

  // Credential ID length (2 bytes big-endian)
  const credIdLen = (authData[offset] << 8) | authData[offset + 1];
  offset += 2;

  // Skip credential ID bytes
  offset += credIdLen;

  // Parse COSE public key (remaining authData)
  const coseKeyData = authData.slice(offset);
  const coseKey = parseCBOR(coseKeyData) as Map<unknown, unknown>;

  // COSE key map: -2 → x coordinate, -3 → y coordinate
  const x = coseKey.get(-2) as Uint8Array;
  const y = coseKey.get(-3) as Uint8Array;

  if (!x || !y) {
    throw new Error('Could not extract public key coordinates from COSE key');
  }

  return {
    credentialId: base64urlEncode(credential.rawId),
    pubKeyX: '0x' + bufferToHex(x),
    pubKeyY: '0x' + bufferToHex(y),
    rawId: new Uint8Array(credential.rawId),
  };
}

/**
 * Sign a challenge using an existing passkey.
 * Returns the P-256 signature (r, s) and authenticator metadata.
 */
export async function signChallenge(
  credentialId: string,
  challenge: Uint8Array
): Promise<SignatureData> {
  const rawId = base64urlDecode(credentialId);
  const getOptions: PublicKeyCredentialRequestOptions = {
    allowCredentials: [
      {
        id: rawId.buffer as ArrayBuffer,
        type: 'public-key',
      },
    ],
    userVerification: 'required',
    challenge: challenge.buffer as ArrayBuffer,
  };

  const assertion = (await navigator.credentials.get({
    publicKey: getOptions,
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Passkey authentication was cancelled or failed');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;

  // Parse DER-encoded signature → raw (r, s)
  const derSig = new Uint8Array(response.signature);
  const { r, s } = parseDERSignature(derSig);

  // Extract authenticatorData and clientDataJSON
  const authenticatorData = new Uint8Array(response.authenticatorData);
  const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);

  return {
    r: '0x' + bufferToHex(r),
    s: '0x' + bufferToHex(s),
    authenticatorData: '0x' + bufferToHex(authenticatorData),
    clientDataJSON,
  };
}
