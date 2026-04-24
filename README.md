# 0G KV Store

Persistent decentralised key-value storage for agent memory, built on the [0G Storage Network](https://docs.0g.ai/developer-hub/building-on-0g/storage/overview).

## How It Works

0G has no native "update" operation — it is content-addressed immutable storage. KV semantics are layered on top:

| Operation | Mechanism |
|---|---|
| **Write** | Upload a stream-encoded blob → receive a `rootHash` |
| **Read** | Download blob by `rootHash` → decode binary stream format → parse JSON |
| **Update** | Write new blob → replace stored `rootHash` pointer |
| **History** | Keep all old `rootHash` values → every version permanently retrievable |

The `rootHash` is the permanent address of your data on the decentralised network. You must persist it (in a database, on-chain registry, or another 0G KV entry) to retrieve the value later.

## Quick Start

```bash
cd kvstore
npm install
cp .env.example .env
# edit .env with your private key and wallet address
npm test
```

## Project Structure

```
kvstore/
  src/
    config.ts     # Env var loading + stream ID derivation
    kv.ts         # kvSet() and kvGet() — core write/read logic
    index.ts      # Barrel re-exports
    test.ts       # End-to-end test: write 3 keys, read them back
  .env.example    # Config template
  package.json
  tsconfig.json
  README.md
```

## API

### `kvSet(key, value)` → `WriteResult`

Writes a key-value pair to 0G KV Storage and returns the root hash.

```typescript
import { kvSet } from './src';

const result = await kvSet('twin:preferences', {
  theme: 'dark',
  riskTolerance: 0.4,
});

console.log(result.rootHash); // 0xe54efb...
console.log(result.txHash);   // 0x4db55c... (empty if deduplicated)
```

**Important:** Save `result.rootHash` — it is required to read the value back.

### `kvGet<T>(key, rootHash)` → `ReadResult<T>`

Reads a value by its root hash. Generic over `T` for type-safe responses.

```typescript
import { kvGet } from './src';

interface Preferences { theme: string; riskTolerance: number }

const result = await kvGet<Preferences>('twin:preferences', '0xe54efb...');
console.log(result.value.theme); // 'dark'
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ZG_PRIVATE_KEY` | ✅ | 64-char hex private key (no `0x` prefix) |
| `ZG_WALLET_ADDRESS` | ✅ | EVM wallet address (`0x…`) |
| `ZG_EVM_RPC` | | RPC URL (default: 0G Testnet) |
| `ZG_INDEXER_RPC` | | Indexer URL (default: testnet turbo) |
| `ZG_STREAM_ID` | | Custom 32-byte stream ID (default: derived from wallet) |

## Network

| | Testnet (Galileo) | Mainnet |
|---|---|---|
| RPC | `https://evmrpc-testnet.0g.ai` | `https://evmrpc.0g.ai` |
| Indexer (turbo) | `https://indexer-storage-testnet-turbo.0g.ai` | `https://indexer-storage-turbo.0g.ai` |
| Explorer | https://storagescan-galileo.0g.ai | https://storagescan.0g.ai |
| Chain ID | 16602 | 16661 |
| Faucet | https://faucet.0g.ai | — |

## Key Concepts

### Stream ID

Every KV namespace on 0G is identified by a **stream ID** — a 32-byte hex address. This acts like a "table name". By default it is derived from your wallet address:

```
0x + 24_zeros + your_wallet_address_without_0x
```

Multiple agents can write to the same stream if they share the stream ID and both have write access.

### Access Control

On first write, the caller is granted `GrantAdminRole` (type `0`) on the stream. Subsequent writes from the same address proceed without re-granting. You can also grant/revoke write access to other addresses using the `controls` array on `StreamDataBuilder`.

### Deduplication

0G content-addresses all data. If you write the same value twice (identical bytes), the second write skips the on-chain transaction and returns the existing root hash for free. The `txHash` will be empty in this case.

### Reading Without a Root Hash

If you lose the root hash, the value is not retrievable by key alone — there is no global KV key index on the testnet. **Always persist root hashes** after writing. A common pattern is to store the index itself as a JSON file uploaded to 0G Storage, whose root hash is stored on-chain in a smart contract or in another well-known location.

## Use in the Digital Twin Agent

The `openagent` digital twin uses this pattern:

```
KV (mutable pointers):
  twin:preferences      → rootHash_A  (latest)
  twin:last_session     → rootHash_B
  twin:learned_patterns → rootHash_C

On update:
  kvSet('twin:preferences', newPrefs) → rootHash_D
  update pointer: twin:preferences → rootHash_D
  rootHash_A still retrievable — full version history
```

This gives the agent both **real-time state** (latest root hash) and **immutable history** (all previous root hashes) — all stored on the decentralised 0G network with no central server.

## Links

- [0G Storage SDK](https://github.com/0gfoundation/0g-ts-sdk)
- [0G Storage Docs](https://docs.0g.ai/developer-hub/building-on-0g/storage/overview)
- [KV Store Docs](https://docs.0g.ai/developer-hub/building-on-0g/storage/kv-store)
- [Storage Starter Kit](https://github.com/0gfoundation/0g-storage-ts-starter-kit)
- [Testnet Explorer](https://storagescan-galileo.0g.ai)
