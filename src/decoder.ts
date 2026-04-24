/**
 * Binary decoder for the 0G stream format.
 *
 * 0G embeds key-value writes inside a binary "stream" blob. This module
 * parses that blob and extracts the value bytes for the first write entry.
 *
 * Stream binary layout
 * ───────────────────────────────────────────────────────────────────────
 *  version (8 bytes, uint64 BE)
 *  readsCount (4 bytes, uint32 BE)
 *  for each read:
 *    streamId (32 bytes)
 *    keyLen   (3 bytes, uint24 BE)
 *    key      (keyLen bytes)
 *  writesCount (4 bytes, uint32 BE)
 *  for each write — metadata section:
 *    streamId (32 bytes)
 *    keyLen   (3 bytes, uint24 BE)
 *    key      (keyLen bytes)
 *    valLen   (8 bytes, uint64 split as hi(4B) + lo(4B) BE)
 *  for each write — value section (same order):
 *    value    (valLen bytes)
 *  controls (remainder)
 * ───────────────────────────────────────────────────────────────────────
 *
 * @internal
 */
export function decodeFirstValue(rawBuf: Buffer): string | null {
  let offset = 0;

  // Skip version field (8 bytes)
  offset += 8;

  // Skip reads section
  const readsCount = rawBuf.readUInt32BE(offset);
  offset += 4;
  for (let i = 0; i < readsCount; i++) {
    offset += 32; // streamId
    const keyLen = (rawBuf[offset] << 16) | (rawBuf[offset + 1] << 8) | rawBuf[offset + 2];
    offset += 3 + keyLen;
  }

  // Parse writes metadata section to extract value sizes
  const writesCount = rawBuf.readUInt32BE(offset);
  offset += 4;

  if (writesCount === 0) return null;

  const valueSizes: number[] = [];
  for (let i = 0; i < writesCount; i++) {
    offset += 32; // streamId
    const keyLen = (rawBuf[offset] << 16) | (rawBuf[offset + 1] << 8) | rawBuf[offset + 2];
    offset += 3 + keyLen;
    // uint64 stored as two uint32s (hi, lo) — values are small enough to fit in JS number
    const hi = rawBuf.readUInt32BE(offset); offset += 4;
    const lo = rawBuf.readUInt32BE(offset); offset += 4;
    valueSizes.push(hi * 2 ** 32 + lo);
  }

  // Values section immediately follows — return the first one
  return rawBuf.slice(offset, offset + valueSizes[0]).toString('utf-8');
}
