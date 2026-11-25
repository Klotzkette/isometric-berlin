import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../../..");
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

type Layer = {
  isAddition(path: string): boolean;
  restore(path: string, bytes: Uint8Array): Uint8Array;
  project(source: string): string;
  verify(before: Readonly<Record<string, string>>, files: readonly string[]): void;
};

export function readSourceHistoryLayer(
  version: string, baseline: string, fixture: URL, checksum: string, next?: Layer,
): Layer {
  const proof = readFileSync(fixture);
  if (digest(proof) !== checksum) throw new Error(`Changed immutable ${version} source proof`);
  const receipt = JSON.parse(proof.toString()) as {
    changes: Record<string, { before: string; after: string }>;
    additions: Record<string, string>;
  };
  const previous = new Map<string, Buffer>();
  function predecessor(path: string): Buffer {
    const cached = previous.get(path);
    if (cached) return cached;
    const raw = execFileSync("git", ["show", `${baseline}:${path}`], { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
    if (digest(raw) !== receipt.changes[path].before) throw new Error(`Changed ${version} predecessor: ${path}`);
    previous.set(path, raw);
    return raw;
  }
  function current(path: string, bytes: Uint8Array): Uint8Array {
    return next ? next.restore(path, bytes) : bytes;
  }
  return {
    isAddition(path) {
      return Object.hasOwn(receipt.additions, path) || Boolean(next?.isAddition(path));
    },
    restore(path, bytes) {
      const change = receipt.changes[path];
      if (!change) return current(path, bytes);
      if (next && digest(bytes) === change.before) return bytes;
      const exact = current(path, bytes);
      const hash = digest(exact);
      if (hash === change.before) return exact;
      if (hash !== change.after) throw new Error(`Unknown exact ${version} source bytes: ${path}`);
      return predecessor(path);
    },
    project(source) {
      const exact = next ? next.project(source) : source;
      const hash = digest(exact);
      const path = Object.keys(receipt.changes).find(name => receipt.changes[name].after === hash);
      return path ? predecessor(path).toString() : exact;
    },
    verify(before, files) {
      if (next) {
        const snapshot = { ...before, ...receipt.additions };
        for (const [path, change] of Object.entries(receipt.changes)) snapshot[path] = change.after;
        next.verify(snapshot, files);
      }
      for (const [path, change] of Object.entries(receipt.changes)) {
        if (before[path] !== change.before) throw new Error(`Unexpected ${version} source change: ${path}`);
        predecessor(path);
        const bytes = current(path, readFileSync(resolve(repository, path)));
        if (digest(bytes) !== change.after) throw new Error(`Changed ${version} result: ${path}`);
      }
      for (const [path, hash] of Object.entries(receipt.additions)) {
        const registered = !Object.hasOwn(before, path) && (path.endsWith(".json.gz") || files.includes(path));
        const bytes = current(path, readFileSync(resolve(repository, path)));
        if (!registered || digest(bytes) !== hash) throw new Error(`Changed ${version} addition: ${path}`);
      }
    },
  };
}
