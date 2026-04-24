import { Batcher, Indexer, getFlowContract, StorageNode } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { config } from './config';
import { decodeFirstValue } from './decoder';
import type { WriteResult, ReadResult, NodeStatus } from './types';

export type { WriteResult, ReadResult } from './types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toBytes(str: string): Uint8Array {
  return Uint8Array.from(Buffer.from(str, 'utf-8'));
}

async function getContext(): Promise<{
  indexer: Indexer;
  nodes: StorageNode[];
  flow: ReturnType<typeof getFlowContract>;
}> {
  const provider = new ethers.JsonRpcProvider(config.evmRpc);
  const signer   = new ethers.Wallet(config.privateKey, provider);
  const indexer  = new Indexer(config.indexerRpc);

  const [nodes, err] = await indexer.selectNodes(1);
  if (err) throw new Error(`selectNodes failed: ${err}`);

  // Flow contract address is auto-discovered from the storage node's status.
  // This avoids hardcoding addresses that change across testnet resets.
  const status = await (nodes[0] as unknown as { getStatus(): Promise<NodeStatus> }).getStatus();
  if (!status) throw new Error('Could not get storage node status');

  const flow = getFlowContract(status.networkIdentity.flowAddress, signer as unknown as Parameters<typeof getFlowContract>[1]);
  return { indexer, nodes, flow };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Write a key-value pair to 0G KV Storage.
 * Returns the root hash — store this to retrieve the value later.
 */
export async function kvSet(key: string, value: unknown): Promise<WriteResult> {
  const { nodes, flow } = await getContext();
  const batcher = new Batcher(1, nodes, flow, config.evmRpc);

  // Grant admin role on first write — no-op if already initialised.
  batcher.streamDataBuilder.controls.push({
    Type: 0, // GrantAdminRole
    StreamId: config.streamId,
    Account: config.walletAddress,
  });

  batcher.streamDataBuilder.set(
    config.streamId,
    toBytes(key),
    toBytes(typeof value === 'string' ? value : JSON.stringify(value)),
  );

  const [tx, err] = await batcher.exec();
  if (err) throw new Error(`KV write failed: ${err}`);

  return { txHash: tx.txHash ?? '', rootHash: tx.rootHash, key };
}

/**
 * Read a value from 0G KV Storage by its root hash.
 * The root hash is returned by kvSet() and must be persisted by the caller.
 */
export async function kvGet<T = unknown>(key: string, rootHash: string): Promise<ReadResult<T>> {
  const { indexer } = await getContext();
  const tmpPath = path.join(os.tmpdir(), `og_kv_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const err = await indexer.download(rootHash, tmpPath, false);
  if (err) throw new Error(`KV read failed for key "${key}": ${err}`);

  const raw = fs.readFileSync(tmpPath);
  fs.unlinkSync(tmpPath);

  const valueStr = decodeFirstValue(raw);
  if (valueStr === null) throw new Error(`Could not decode value for key "${key}"`);

  let value: T;
  try {
    value = JSON.parse(valueStr) as T;
  } catch {
    value = valueStr as unknown as T;
  }

  return { key, value, rootHash };
}
