/** Offline-only finite gzip verification/reproduction; never edits source assets. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { gzipAsync } from '@gfx/zopfli';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..');
const folder = 'mesh/surrounding-berlin-v159';
const args = process.argv.slice(2);
const verifyOnly = args[0] === '--verify-dir';
const noWrite = args[0] !== '--out';
if (args.length !== 2 || !['--out', '--verify-dir', '--reproduce-check'].includes(args[0])) {
  throw new Error('Usage: bun scripts/reproduce-public-gzip-v352.ts --out /detached/output (or --verify-dir /existing/candidates, --reproduce-check /detached/output)');
}
const output = resolve(args[1]);
const rel = relative(repo, output);
if (!rel.startsWith('..') && !rel.startsWith('/')) throw new Error('Output must be outside the repository');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const pinsBytes = readFileSync(join(app, 'publicLosslessV352Sources.json'));
if (hash(pinsBytes) !== 'eea9eae4051b5ecf05bcb64a5aadfec690a90ba15f4a27280da2337e1752daeb') throw new Error('Literal V352 selection changed');
const pins = JSON.parse(pinsBytes.toString());
const blob = (rev: string, path: string) => execFileSync('git', ['show', `${rev}:${path}`], { cwd: repo, maxBuffer: 16 * 1024 * 1024 });
const manifest = JSON.parse(blob(pins.basePublicCommit, `${folder}/manifest.json`).toString());
const chunks = new Map(manifest.chunks.map((c: any) => [c.id, c]));
const fail = (test: boolean, message: string) => { if (!test) throw new Error(message); };
fail(pins.rows.length === 48 && pins.selectedPackets === 48 && pins.savedPacketBytes === 2180970, 'Finite selection count changed');
fail(pins.rows.reduce((sum: number, r: any) => sum + r.savedBytes, 0) === pins.savedPacketBytes, 'Pinned savings differ');
const inputs = pins.rows.map((row: any) => {
  const path = `${folder}/${row.file}`;
  const old = blob(pins.basePublicCommit, path);
  const source = blob(pins.baseSourceCommit, `src/app/public/${path}`);
  const current = readFileSync(join(app, 'public', path));
  fail(old.equals(source) && old.equals(current), `Source/public divergence: ${row.file}`);
  fail(old.length === row.oldBytes && hash(old) === row.oldSha256, `Old wire mismatch: ${row.file}`);
  const chunk: any = chunks.get(row.id);
  fail(JSON.stringify(chunk.bounds) === JSON.stringify(row.chunkBounds), `Bounds mismatch: ${row.file}`);
  fail(JSON.stringify(chunk[row.mode]) === JSON.stringify(row.oldDescriptor), `Descriptor mismatch: ${row.file}`);
  const raw = gunzipSync(old);
  fail(raw.length === row.decodedBytes && hash(raw) === row.decodedSha256, `Decoded input mismatch: ${row.file}`);
  return { row, raw };
});
if (!noWrite) mkdirSync(output, { recursive: true });
for (const { row, raw } of inputs) {
  const path = join(output, row.file);
  const candidate = verifyOnly ? readFileSync(path) : Buffer.from(await gzipAsync(raw, { numiterations: 1 }));
  fail(candidate.length === row.newBytes && hash(candidate) === row.newSha256, `Reproduction differs: ${row.file}`);
  fail(gunzipSync(candidate).equals(raw), `Decoded content differs: ${row.file}`);
  if (!noWrite) {
    if (existsSync(path)) fail(readFileSync(path).equals(candidate), `Existing output differs: ${row.file}`);
    else { writeFileSync(`${path}.tmp`, candidate); renameSync(`${path}.tmp`, path); }
  }
  console.log(`${row.file}: decoded bytes equal; saves ${row.savedBytes} bytes`);
}
const receipt = { pinsSha256: hash(pinsBytes), selectedPackets: pins.selectedPackets, savedPacketBytes: pins.savedPacketBytes, completeDecodedBytesEqual: true, sourceAndPublicBaselineEqual: true, sourceFilesUnchanged: true, codec: 'gzip', compressor: '@gfx/zopfli 1.0.15; numiterations:1', verifyOnly, noWrite };
if (!noWrite) writeFileSync(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
