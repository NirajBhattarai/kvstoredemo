/**
 * 0G KV Store — end-to-end test
 *
 * Writes 3 Digital Twin memory keys to 0G Testnet (Galileo),
 * waits for storage propagation, then reads them back.
 *
 * Run:  npm test   (or: npx ts-node src/test.ts)
 */

import { kvSet, kvGet } from './kv';
import { config } from './config';

// ─── Digital Twin test entries ────────────────────────────────────────────────

interface Preferences {
  theme: string;
  language: string;
  riskTolerance: number;
  prefersMorning: boolean;
}

interface LastSession {
  topic: string;
  timestamp: number;
  mood: string;
}

interface LearnedPatterns {
  avoidsHighRisk: boolean;
  followsBTC: boolean;
  weeklyReview: boolean;
}

const TEST_ENTRIES = [
  {
    key: 'twin:preferences',
    value: { theme: 'dark', language: 'en', riskTolerance: 0.4, prefersMorning: true } satisfies Preferences,
  },
  {
    key: 'twin:last_session',
    value: { topic: 'crypto trading', timestamp: Date.now(), mood: 'focused' } satisfies LastSession,
  },
  {
    key: 'twin:learned_patterns',
    value: { avoidsHighRisk: true, followsBTC: true, weeklyReview: true } satisfies LearnedPatterns,
  },
] as const;

// ─── Root hash index (key → rootHash) — in production, persist this to disk / chain ──

const index: Record<string, string> = {};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║      0G KV Store — Digital Twin Memory       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Wallet:  ${config.walletAddress}`);
  console.log(`Network: 0G Testnet Galileo (chain 16602)`);
  console.log(`Stream:  ${config.streamId}`);

  // ── WRITE ────────────────────────────────────────────────────────────────
  console.log('\n╔══ WRITE PHASE ═══════════════════════════════╗');
  for (const entry of TEST_ENTRIES) {
    try {
      console.log(`\n📝 Writing key "${entry.key}"...`);
      const result = await kvSet(entry.key, entry.value);
      index[entry.key] = result.rootHash;
      console.log(`   ✓ txHash:   ${result.txHash || '(deduplicated — already on-chain)'}`);
      console.log(`   ✓ rootHash: ${result.rootHash}`);
      if (result.txHash) {
        console.log(`   ✓ Explorer: https://storagescan-galileo.0g.ai/tx/${result.txHash}`);
      }
    } catch (err) {
      console.error(`   ✗ Write failed: ${(err as Error).message}`);
    }
  }

  // ── WAIT ─────────────────────────────────────────────────────────────────
  console.log('\n⏳ Waiting 15s for storage nodes to propagate...');
  await new Promise((r) => setTimeout(r, 15_000));

  // ── READ ─────────────────────────────────────────────────────────────────
  console.log('\n╔══ READ PHASE ════════════════════════════════╗');
  for (const entry of TEST_ENTRIES) {
    try {
      console.log(`\n🔍 Reading key "${entry.key}"...`);
      const rootHash = index[entry.key];
      if (!rootHash) {
        console.log('   ⚠ No root hash — write may have failed');
        continue;
      }
      const result = await kvGet(entry.key, rootHash);
      console.log(`   ✓ Value:    ${JSON.stringify(result.value)}`);
      console.log(`   ✓ rootHash: ${result.rootHash}`);
    } catch (err) {
      console.error(`   ✗ Read failed: ${(err as Error).message}`);
    }
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n╔══ ROOT HASH INDEX ═══════════════════════════╗');
  console.log('Save these root hashes to retrieve values in future runs:\n');
  for (const [key, hash] of Object.entries(index)) {
    console.log(`  ${key.padEnd(26)} → ${hash}`);
  }
  console.log('\nView on-chain: https://storagescan-galileo.0g.ai');
  console.log('═══════════════════════════════════════════════');
}

main().catch((err: Error) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
