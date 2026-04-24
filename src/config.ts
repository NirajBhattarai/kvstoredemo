import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  privateKey:    requireEnv('ZG_PRIVATE_KEY'),
  walletAddress: requireEnv('ZG_WALLET_ADDRESS'),
  evmRpc:        process.env.ZG_EVM_RPC     ?? 'https://evmrpc-testnet.0g.ai',
  indexerRpc:    process.env.ZG_INDEXER_RPC ?? 'https://indexer-storage-testnet-turbo.0g.ai',

  /** Stream ID — 32-byte hex namespace. Defaults to wallet-padded address. */
  get streamId(): string {
    if (process.env.ZG_STREAM_ID) return process.env.ZG_STREAM_ID;
    // Pad wallet address to 32 bytes: 0x + 24 zero-padding + 40-char address
    const addr = this.walletAddress.replace(/^0x/i, '').toLowerCase();
    return '0x' + '0'.repeat(64 - addr.length) + addr;
  },
} as const;
