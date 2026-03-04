// ============================================================
// WebAuthn passkey utilities for the demo app.
// Adapted from sdk/src/webauthn.ts — standalone, no SDK imports.
// ============================================================

export interface PasskeyCredential {
  credentialId: string;
  pubKeyX: string;
  pubKeyY: string;
}

export interface SignatureData {
  r: string;
  s: string;
  authenticatorData: string;
  clientDataJSON: string;
}

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

// ============================================================
// Minimal CBOR decoder (subset for WebAuthn parsing)
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
    argValue = argValue >>> 0;
    offset += 4;
  } else {
    throw new Error(`CBOR: unsupported additional info ${additionalInfo}`);
  }

  switch (majorType) {
    case 0:
      return { value: argValue, offset };
    case 1:
      return { value: -1 - argValue, offset };
    case 2: {
      const bytes = data.slice(offset, offset + argValue);
      return { value: bytes, offset: offset + argValue };
    }
    case 3: {
      const textBytes = data.slice(offset, offset + argValue);
      const text = new TextDecoder().decode(textBytes);
      return { value: text, offset: offset + argValue };
    }
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
// ============================================================

function normalizeInteger(bytes: Uint8Array, length: number): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0x00) {
    start++;
  }
  const trimmed = bytes.slice(start);

  if (trimmed.length === length) {
    return trimmed;
  }
  if (trimmed.length > length) {
    return trimmed.slice(trimmed.length - length);
  }
  const padded = new Uint8Array(length);
  padded.set(trimmed, length - trimmed.length);
  return padded;
}

function parseDERSignature(sig: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  let offset = 0;

  if (sig[offset] !== 0x30) {
    throw new Error('DER: expected SEQUENCE tag 0x30');
  }
  offset++;

  const totalLen = sig[offset];
  offset++;
  if (totalLen & 0x80) {
    const lenBytes = totalLen & 0x7f;
    offset += lenBytes;
  }

  if (sig[offset] !== 0x02) {
    throw new Error('DER: expected INTEGER tag 0x02 for r');
  }
  offset++;
  const rLen = sig[offset];
  offset++;
  const rBytes = new Uint8Array(sig.slice(offset, offset + rLen));
  offset += rLen;

  if (sig[offset] !== 0x02) {
    throw new Error('DER: expected INTEGER tag 0x02 for s');
  }
  offset++;
  const sLen = sig[offset];
  offset++;
  const sBytes = new Uint8Array(sig.slice(offset, offset + sLen));

  const r = normalizeInteger(rBytes, 32);
  const s = normalizeInteger(sBytes, 32);

  return { r, s };
}

// ============================================================
// Public API
// ============================================================

/**
 * Create a new passkey and extract the P-256 public key coordinates.
 */
export async function createPasskey(username: string): Promise<PasskeyCredential> {
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
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
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

  const attestation = parseCBOR(attestationObject) as Map<unknown, unknown>;
  const authData = attestation.get('authData') as Uint8Array;

  if (!authData) {
    throw new Error('No authData in attestation object');
  }

  // Parse authData: rpIdHash(32) + flags(1) + signCount(4) = 37
  let offset = 37;

  // AAGUID (16 bytes)
  offset += 16;

  // Credential ID length (2 bytes big-endian)
  const credIdLen = (authData[offset] << 8) | authData[offset + 1];
  offset += 2;

  // Skip credential ID bytes
  offset += credIdLen;

  // Parse COSE public key
  const coseKeyData = authData.slice(offset);
  const coseKey = parseCBOR(coseKeyData) as Map<unknown, unknown>;

  const x = coseKey.get(-2) as Uint8Array;
  const y = coseKey.get(-3) as Uint8Array;

  if (!x || !y) {
    throw new Error('Could not extract public key coordinates from COSE key');
  }

  return {
    credentialId: base64urlEncode(credential.rawId),
    pubKeyX: '0x' + bufferToHex(x),
    pubKeyY: '0x' + bufferToHex(y),
  };
}

/**
 * Sign a challenge using an existing passkey.
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
  const derSig = new Uint8Array(response.signature);
  const { r, s } = parseDERSignature(derSig);

  const authenticatorData = new Uint8Array(response.authenticatorData);
  const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);

  return {
    r: '0x' + bufferToHex(r),
    s: '0x' + bufferToHex(s),
    authenticatorData: '0x' + bufferToHex(authenticatorData),
    clientDataJSON,
  };
}
