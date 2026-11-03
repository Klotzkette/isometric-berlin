/** Build-only exact word transport for NEW v307 Core and rail model meshes. Old variants and
 * every source attribute word survive; no old source/history pin is replaced. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { decodeLosslessWordPlanesV309, encodeLosslessWordPlanesV309 } from "../src/losslessWordStreamV309";
const args = process.argv.slice(2), value = (flag: string) => args[args.indexOf(flag) + 1];
const input = args.includes("--input") ? value("--input") : fileURLToPath(new URL("../src/data/coreTerrainContactV307.json", import.meta.url));
const output = args.includes("--out") ? value("--out") : undefined;
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const original = readFileSync(input), data = JSON.parse(original.toString());
const field = data.field === "humboldthain" && data.meshes?.length && data.variants ? "meshes" : Array.isArray(data.models) && data.models.length === 16 && data.models.every((m: {key:string}) => m.key.startsWith("complete-rail-sports-architecture-v307:")) ? "models" : undefined;
if (data.schemaVersion !== 1 || !field) throw Error("Explicit finite new v307 source required");
const complement = () => JSON.stringify(Object.fromEntries(Object.entries(data).filter(([key]) => key !== field)));
const meshComplement = () => JSON.stringify(data[field].map((mesh: Record<string,unknown>) => Object.fromEntries(Object.entries(mesh).filter(([key]) => !["positions","indices","positionsCodec","indicesCodec"].includes(key)))));
const unchanged = complement(), unchangedMeshFields = meshComplement(), proof: unknown[] = [];
for (const mesh of data[field]) {
  if (mesh.positionType !== "f32" || mesh.positionsCodec || mesh.indicesCodec) throw Error("Only unencoded new exact Float32 mesh words may be packed");
  for (const [field, stride, count] of [["positions", 3, mesh.vertices * 3], ["indices", 1, mesh.triangles * 3]] as const) {
    const raw = Buffer.from(mesh[field], "base64");
    if (raw.byteLength !== count * 4) throw Error("Incomplete original Core attribute");
    const words = new Uint32Array(raw.buffer, raw.byteOffset, count), packed = encodeLosslessWordPlanesV309(words, stride), encoded = Buffer.from(packed).toString("base64");
    const restored = decodeLosslessWordPlanesV309(encoded, count, stride), bytes = new Uint8Array(restored.buffer, restored.byteOffset, restored.byteLength);
    if (!raw.equals(bytes) || sha(raw) !== sha(bytes)) throw Error("Exact Core word proof failed");
    mesh[field] = encoded; mesh[`${field}Codec`] = `u32-delta-byteplanes-stride${stride}-v1`;
    proof.push({ mesh: mesh.key, field, stride, count, decodedBytes: raw.byteLength, packedBytes: packed.byteLength, decodedSha256: sha(raw), packedSha256: sha(packed) });
  }
}
if (complement() !== unchanged || meshComplement() !== unchangedMeshFields) throw Error("Immutable source complement changed");
const encoded = Buffer.from(JSON.stringify(data)), receipt = {
  schemaVersion: 1, codec: "u32-delta-byteplanes-v1", source: field === "meshes" ? "coreTerrainContactV307.json" : "railSseArchitectureV307.json", scope: `new ${field}.positions and ${field}.indices only`,
  beforeSha256: sha(original), afterSha256: sha(encoded), unchangedComplementSha256: sha(unchanged), unchangedMeshFieldsSha256: sha(unchangedMeshFields),
  ...(field === "meshes" ? { unchangedVariantsSha256: sha(JSON.stringify(data.variants)) } : {}),
  beforeBytes: original.byteLength, afterBytes: encoded.byteLength,
  beforeGzipBytes: gzipSync(original, { level: 9 }).byteLength, afterGzipBytes: gzipSync(encoded, { level: 9 }).byteLength,
  words: proof,
};
if (output) writeFileSync(output, encoded);
if (args.includes("--receipt")) writeFileSync(value("--receipt"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt));
