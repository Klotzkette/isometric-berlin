/** Verify the public visual-mode delta before replaying earlier source layers. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SOURCE_HISTORY_PROOF_SHA_V337 = "8756b51eff6158d0fed21bb189a13cad9c79e126e34ab2eb1bf6aa7c7ac977c7";
const previousProof = "c6c9a3c7a4cb32839f0b98170177d2ef5d46ae7980eb0ea9718c154eae9cea1d";
const captureTool = "3c8223c831bc59e4eb4c09a78c12d824e40abd07889d74ad98c786193637f00b";
const previousGraphHash = "793716e8a2bf1237edefe0a4ab8712d66708a6c4f092f58820e892f9c928417d";
const previousCommit = "6046c1b19018bda98b3e6f16538c487caab643f1";
const expectedChanges = [
  "src/app/src/App.tsx",
  "src/app/src/StartupModeSelection.tsx",
  "src/app/src/ThreeViewer.tsx",
  "src/app/src/localization.ts",
  "src/app/src/modeLinks.ts",
];
const root = resolve(import.meta.dir, "../../../..");
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const fixture = (version: number) => readFileSync(new URL(`../fixtures/source-history-v${version}.json`, import.meta.url));

type Inverse = {
  beforeSha256: string;
  currentSha256: string;
  replacements: { before: string; current: string }[];
};
let checked: {
  current: Readonly<Record<string, string>>;
  changes: Record<string, Inverse>;
} | undefined;

function project(source: string, inverse: Inverse): string {
  for (const { before, current } of inverse.replacements) {
    if (!current || source.split(current).length !== 2) throw Error("Ambiguous exact v337 source inverse");
    source = source.replace(current, () => before);
  }
  if (sha(source) !== inverse.beforeSha256) throw Error("Changed full v337 source complement");
  return source;
}

export function assertSourceLayerV337(previous: Readonly<Record<string, string>>): void {
  if (checked) return;
  const raw = fixture(337);
  if (sha(fixture(336)) !== previousProof || sha(raw) !== SOURCE_HISTORY_PROOF_SHA_V337)
    throw Error("Changed immutable v336/v337 source proof");
  const paths = Object.keys(previous).sort();
  const sorted = Object.fromEntries(paths.map(path => [path, previous[path]]));
  if (paths.length !== 2194 || sha(JSON.stringify(sorted)) !== previousGraphHash)
    throw Error("Incomplete v336 source graph");

  const receipt = JSON.parse(raw.toString("utf8")) as {
    schemaVersion: number; previousCommit: string; previousProofSha256: string; captureToolSha256: string;
    additions: Record<string, string>; changes: Record<string, Inverse>;
  };
  if (receipt.schemaVersion !== 1 || receipt.previousCommit !== previousCommit
      || receipt.previousProofSha256 !== previousProof || receipt.captureToolSha256 !== captureTool)
    throw Error("Unknown immutable v337 source anchors");
  if (Object.keys(receipt.additions).length !== 0 || Object.keys(receipt.changes).length !== expectedChanges.length
      || expectedChanges.some(path => !Object.hasOwn(receipt.changes, path)))
    throw Error("Invalid finite v337 source delta");

  const current = { ...previous };
  for (const [path, inverse] of Object.entries(receipt.changes)) {
    if (previous[path] !== inverse.beforeSha256 || inverse.currentSha256 === inverse.beforeSha256
        || !inverse.replacements.length) throw Error(`Invalid exact v337 source change: ${path}`);
    current[path] = inverse.currentSha256;
  }
  const counts = new Map<string, number>();
  for (const digest of Object.values(current)) counts.set(digest, (counts.get(digest) ?? 0) + 1);
  for (const { currentSha256 } of Object.values(receipt.changes)) {
    if (counts.get(currentSha256) !== 1) throw Error("Ambiguous full v337 source fingerprint");
  }

  const files = readdirSync(resolve(root, "src/app/src"), { recursive: true }).map(path => `src/app/src/${path}`)
    .filter(path => /\.(?:ts|tsx|json)$/.test(path) && statSync(resolve(root, path)).isFile());
  const inventory = new Set([...paths, ...files]);
  if (inventory.size !== Object.keys(current).length || [...inventory].some(path => !Object.hasOwn(current, path)))
    throw Error("Changed or unaccounted v337 source inventory");
  for (const path of inventory) {
    const source = readFileSync(resolve(root, path));
    if (sha(source) !== current[path]) throw Error(`Changed complete v337 source graph: ${path}`);
    if (Object.hasOwn(receipt.changes, path)) project(source.toString("utf8"), receipt.changes[path]);
  }
  checked = { current: Object.freeze(current), changes: receipt.changes };
}

export function sourceChangedSinceV336(path: string): boolean {
  return expectedChanges.includes(path);
}

export function sourceAtBeforeV337(path: string, raw: Uint8Array): Uint8Array {
  if (!checked || !Object.hasOwn(checked.current, path) || sha(raw) !== checked.current[path])
    throw Error(`Unknown exact v337 source bytes: ${path}`);
  const inverse = Object.hasOwn(checked.changes, path) ? checked.changes[path] : undefined;
  return inverse ? Buffer.from(project(Buffer.from(raw).toString("utf8"), inverse)) : raw;
}

export function projectSourceBeforeV337(source: string): string {
  if (!checked) throw Error("Unverified v337 source layer");
  const digest = sha(source);
  const inverse = Object.values(checked.changes).find(change => change.currentSha256 === digest);
  return inverse ? project(source, inverse) : source;
}
