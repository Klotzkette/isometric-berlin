import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

/** Build-only receipts. These do not opt any field into compression or change
 * eager/lazy/weak ownership: the original transformer still makes that choice. */
export type LosslessZopfliField = {
  sourcePath: string;
  key: string;
  exactJsonSha256: string;
  exactJsonBytes: number;
};

// Main and Worker plugin instances share one queue in the build process. Only
// one WASM compression and its decoded source graph are active at a time.
let compressionQueue: Promise<void> = Promise.resolve();

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const task = compressionQueue.then(operation);
  compressionQueue = task.then(() => undefined, () => undefined);
  return task;
}

/** No disk cache and no runtime import. Per-build hashes address only freshly
 * verified source text; the caller discards compressed results at buildEnd. */
export function createLosslessZopfliPreparation(
  fields: readonly LosslessZopfliField[],
  exactJson: (value: unknown) => string,
) {
  const bySource = new Map<string, LosslessZopfliField[]>();
  for (const field of fields) {
    const entries = bySource.get(field.sourcePath) ?? [];
    if (entries.some(entry => entry.key === field.key)) {
      throw new Error(`Duplicate lossless Zopfli receipt: ${field.sourcePath}:${field.key}`);
    }
    entries.push(field);
    bySource.set(field.sourcePath, entries);
  }
  const cache = new Map<string, Uint8Array>();
  return {
    prepare(source: string, id: string): Promise<ReadonlyMap<string, Uint8Array> | undefined> {
      const relative = id.replaceAll("\\", "/").match(/\/src\/app\/src\/(.+\.json)$/)?.[1];
      const selected = relative ? bySource.get(relative) : undefined;
      if (!selected) return Promise.resolve(undefined);
      return serial(async () => {
        const original = source.replace(/^\uFEFF/, "");
        const parsed: unknown = JSON.parse(original);
        const verified: Array<{ json: string; hash: string }> = [];
        // A same-name fixture or later changed source keeps the byte-identical
        // original zlib path. Never apply an old receipt to unverified values.
        // Validate the complete source selection before compressing any field.
        for (const field of selected) {
          if (field.key !== "$root" && (!parsed || typeof parsed !== "object" || !Object.hasOwn(parsed, field.key))) return undefined;
          const json = field.key === "$root" ? original : exactJson((parsed as Record<string, unknown>)[field.key]);
          const hash = createHash("sha256").update(json).digest("hex");
          if (Buffer.byteLength(json) !== field.exactJsonBytes || hash !== field.exactJsonSha256) return undefined;
          verified.push({ json, hash });
        }
        const prepared = new Map<string, Uint8Array>();
        for (const { json, hash } of verified) {
          const input = Buffer.from(json);
          let bytes = cache.get(hash);
          if (!bytes) {
            const { gzipAsync } = await import("@gfx/zopfli");
            bytes = await gzipAsync(input, { numiterations: 5 });
            if (!gunzipSync(bytes).equals(input)) {
              throw new Error(`Lossless Zopfli roundtrip failed: ${relative}:${hash}`);
            }
            cache.set(hash, bytes);
          }
          prepared.set(json, bytes);
        }
        return prepared;
      });
    },
    clear() {
      cache.clear();
    },
  };
}
