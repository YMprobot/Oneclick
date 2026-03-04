export interface OneClickConfig {
  relayerUrl: string;
}

export interface PasskeyCredential {
  credentialId: string;       // base64url encoded
  pubKeyX: string;            // hex string, 32 bytes
  pubKeyY: string;            // hex string, 32 bytes
  rawId: Uint8Array;
}

export interface TransactionRequest {
  target: string;             // address
  value: string;              // wei as string
  data: string;               // hex calldata
  chainId: number;
}

export interface TransactionResponse {
  hash: string;
  chainId: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface WalletInfo {
  address: string;            // smart wallet address
  pubKeyX: string;
  pubKeyY: string;
  credentialId: string;
}

export interface SignatureData {
  r: string;                  // hex, 32 bytes
  s: string;                  // hex, 32 bytes
  authenticatorData: string;  // hex
  clientDataJSON: string;     // raw string
}
