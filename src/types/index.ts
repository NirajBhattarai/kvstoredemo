/**
 * Result returned after a successful KV write operation.
 *
 * The `rootHash` is the permanent content address of the stored data on the
 * 0G Storage Network. You **must** persist it — it is the only way to retrieve
 * the value later via {@link kvGet}.
 */
export interface WriteResult {
  /** On-chain transaction hash. Empty string when the content was already
   *  on-chain (content-addressed deduplication). */
  txHash: string;
  /** 32-byte hex content hash identifying this version of the data. */
  rootHash: string;
  /** The key that was written. */
  key: string;
}

/**
 * Result returned after a successful KV read operation.
 *
 * @typeParam T - Shape of the parsed value. Defaults to `unknown`.
 */
export interface ReadResult<T = unknown> {
  /** The key that was read. */
  key: string;
  /** Parsed value. JSON objects are automatically deserialised; plain strings
   *  are returned as-is. */
  value: T;
  /** Content root hash this value was read from. */
  rootHash: string;
}

/** @internal — used only within the SDK to type the storage node RPC response. */
export interface NodeStatus {
  networkIdentity: {
    flowAddress: string;
  };
}
