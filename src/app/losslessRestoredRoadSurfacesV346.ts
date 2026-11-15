import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import type { Plugin } from "vite";
import { encodeLosslessBase85 } from "./src/losslessGzipBase85";

const MAX_LINE_CHARS = 2 * 1024 * 1024;
export const RESTORED_ROAD_TRANSPORT_V346 = "ndjson-gzip-base85-json";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

/** Build-only representation change. Every bounded original JSON line is
 * compressed independently; the source file and geometry fields stay exact. */
export function compressRestoredRoadSourceV346(source: string) {
  const lines = source.split("\n").filter(line => line.trim());
  if (!lines.length || lines.some(line => line.length > MAX_LINE_CHARS)) throw new Error("Exact street source exceeds its bounded line size");
  const header = JSON.parse(lines[0]);
  if (header.format !== "bounded-source-road-surfaces" || header.version !== 1 || header.encoding !== "ndjson-base64-float32" || header.batch_count !== lines.length - 1) throw new Error("Unexpected exact street source manifest");
  let maxDecodedBatchChars = 0;
  const encoded = lines.slice(1).map(line => {
    JSON.parse(line);
    const raw = Buffer.from(line), packed = gzipSync(raw, { level: 9 });
    if (!gunzipSync(packed).equals(raw)) throw new Error("Exact street gzip roundtrip failed");
    maxDecodedBatchChars = Math.max(maxDecodedBatchChars, line.length);
    const value = encodeLosslessBase85(packed);
    if (value.length > MAX_LINE_CHARS) throw new Error("Compressed street batch exceeds its bounded line size");
    return value;
  });
  const text = [JSON.stringify({ ...header, encoding: RESTORED_ROAD_TRANSPORT_V346 }), ...encoded].join("\n") + "\n";
  const receipt = { schemaVersion: 1, sourceSha256: sha(source), transportSha256: sha(text), sourceBytes: Buffer.byteLength(source), transportBytes: Buffer.byteLength(text), savedBytes: Buffer.byteLength(source) - Buffer.byteLength(text), batchCount: encoded.length, maxDecodedBatchChars, policy: "Independent bounded gzip/Base85 lines; exact JSON, identical geometry constructor, original NDJSON retained; no runtime whole-file inflate." };
  return { text, receipt };
}

export function losslessRestoredRoadSurfacesV346(): Plugin {
  return {
    name: "isometric-berlin-lossless-restored-road-surfaces-v346",
    enforce: "pre",
    apply: "build",
    async load(id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/data/restoredRoadSurfaces.ndjson.txt?url")) return;
      const { text, receipt } = compressRestoredRoadSourceV346(await readFile(id.slice(0, -4), "utf8"));
      const reference = this.emitFile({ type: "asset", name: "restoredRoadSurfaces-gzip-base85-v346.ndjson.txt", source: text });
      this.emitFile({ type: "asset", name: "restored-road-transport-v346-receipt.json", source: JSON.stringify(receipt) + "\n" });
      // Use Vite's own asset placeholder so both ESM and classic IIFE workers
      // receive the correct base-relative URL. Rolldown has no resolveFileUrl
      // hook and a raw ROLLUP_FILE_URL would leave {}.url in an IIFE worker.
      return `export default ${JSON.stringify(`__VITE_ASSET__${reference}__`)};`;
    },
  };
}
