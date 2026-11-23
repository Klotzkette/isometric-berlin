/** Compress the release-audited outer-city packets in package staging.
 * The bitset addresses manifest order (drawn, then minecraft, least bit first).
 * Its inventory digest pins every selected source, URL, owner and bounds. */
import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gzipSync, gunzipSync } from "node:zlib";
import selection from "./offline-delta-selection.json";
import { restoreSurroundingPacketDelta } from "../src/SurroundingPacketDelta";

type Asset = { url: string; bytes: number; decodedBytes: number; sha256: string; deltaDecodedBytes?: number };
type Chunk = { id: string; bounds: number[]; drawn: Asset; minecraft: Asset };
type Mesh = { positions: string; indices: string; positionType?: string };
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const fields = ["positions", "indices"] as const;
const signal = new AbortController().signal;

function encodeField(original: string, positions: boolean): string {
  const raw = Buffer.from(original, "base64");
  const width = positions ? 2 : 4;
  if (!raw.length || raw.length % (positions ? 6 : 4)) return original;
  // Stop as soon as the delta representation cannot shrink this field.
  const output = Buffer.allocUnsafe(raw.length);
  const predictors = [0, 0, 0];
  let cursor = 0;
  for (let offset = 0; offset < raw.length; offset += width) {
    const axis = positions ? offset / width % 3 : 0;
    const next = positions ? raw.readUInt16LE(offset) : raw.readUInt32LE(offset);
    const delta = (next - predictors[axis]) | 0;
    predictors[axis] = next;
    let zigzag = ((delta << 1) ^ (delta >> 31)) >>> 0;
    do {
      if (cursor === output.length) return original;
      const bits = zigzag & 127;
      zigzag >>>= 7;
      output[cursor++] = bits | (zigzag ? 128 : 0);
    } while (zigzag);
  }
  const packed = `~${raw.length}:${output.subarray(0, cursor).toString("base64")}`;
  return packed.length < original.length ? packed : original;
}

// Rewrite only source strings in their original textual JSON. In particular,
// numeric spellings, negative zero, whitespace and navigation survive exactly.
function replaceMeshFields(text: string, replacements: Map<string, string>): string {
  return text.replace(/"(positions|indices)"\s*:\s*"([^"]*)"/g, (match, field, value) => {
    const replacement = replacements.get(field + ":" + value);
    return replacement ? match.slice(0, -value.length - 1) + replacement + '"' : match;
  });
}

async function restoreBytes(packedText: string, size: number) {
  const parsed = JSON.parse(packedText) as { meshes: Mesh[] };
  const packedMeshes = parsed.meshes.map(mesh => ({ ...mesh }));
  await restoreSurroundingPacketDelta(parsed, size - Buffer.byteLength(packedText), signal);
  const restore = new Map<string, string>();
  for (const [i, mesh] of parsed.meshes.entries()) {
    for (const field of fields) {
      const packed = packedMeshes[i][field];
      if (packed !== mesh[field]) restore.set(field + ":" + packed, mesh[field]);
    }
  }
  return { raw: Buffer.from(replaceMeshFields(packedText, restore)), parsed };
}

export async function compactTile(source: Buffer, strongerGzip?: (source: Buffer) => Buffer) {
  const original = source.toString("utf8");
  const parsed = JSON.parse(original) as { meshes: Mesh[] };
  const replacements = new Map<string, string>();
  for (const mesh of parsed.meshes) {
    for (const field of fields) {
      if (field === "positions" && mesh.positionType !== "u16cm") continue;
      const packed = encodeField(mesh[field], field === "positions");
      if (packed !== mesh[field]) replacements.set(field + ":" + mesh[field], packed);
    }
  }
  if (!replacements.size) return;
  const packedText = replaceMeshFields(original, replacements);
  let data: Buffer = gzipSync(packedText, { level: 6 });
  if (strongerGzip) {
    const alternative = strongerGzip(Buffer.from(packedText));
    if (alternative.length < data.length) data = alternative;
  }
  // Prove the actual compressed output with the same inverse as the viewer.
  const verified = await restoreBytes(gunzipSync(data).toString("utf8"), source.length);
  if (!source.equals(verified.raw) || !isDeepStrictEqual(parsed, verified.parsed)) {
    throw Error("Offline delta failed its full source-byte or parsed-object round trip");
  }
  return { data, decodedBytes: Buffer.byteLength(packedText) };
}

function replaceFile(path: string, content: Buffer | string): void {
  writeFileSync(path + ".new", content);
  renameSync(path + ".new", path);
}

async function main() {
  const [mode, source, destination] = process.argv.slice(2);
  if (!source || !destination || !["compact", "gzip", "verify"].includes(mode) || resolve(source) === resolve(destination)) {
    throw Error("Expected compact|gzip|verify <original tile folder> <package tile folder>");
  }
  // A retry always starts from the read-only original, even after an interrupted staging write.
  const manifestPath = join(mode === "verify" ? destination : source, "manifest.json");
  const originalManifest = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(originalManifest) as { chunks: Chunk[] };
  const { chunks } = manifest;
  const mask = Buffer.from(selection.maskBase64, "base64");
  const plainMask = Buffer.from(selection.plainGzipMaskBase64, "base64");
  const deltaCandidates: Asset[] = [];
  const plainCandidates: Asset[] = [];
  const includePlain = mode !== "verify" && hash(originalManifest) === selection.plainGzipManifestSha256;
  const inventory = createHash("sha256");
  let index = 0;
  for (const chunk of chunks) {
    for (const family of ["drawn", "minecraft"] as const) {
      const asset = chunk[family];
      if (mode === "verify" && asset.deltaDecodedBytes !== undefined) {
        const packed = gunzipSync(readFileSync(join(destination, asset.url)));
        const original = gunzipSync(readFileSync(join(source, asset.url)));
        const verified = await restoreBytes(packed.toString("utf8"), original.length);
        if (asset.deltaDecodedBytes !== original.length || !original.equals(verified.raw) ||
            !isDeepStrictEqual(JSON.parse(original.toString("utf8")), verified.parsed)) {
          throw Error("Release delta differs from the source tile: " + asset.url);
        }
      } else if (mode !== "verify" && (mask[index >> 3] & (1 << (index % 8)))) {
        inventory.update([chunk.id, chunk.bounds.join(","), asset.url, asset.bytes, asset.decodedBytes, asset.sha256].join("\t") + "\n");
        deltaCandidates.push(asset);
      } else if (includePlain && (plainMask[index >> 3] & (1 << (index % 8)))) {
        plainCandidates.push(asset);
      }
      index++;
    }
  }
  if (mode === "verify") return;
  if (includePlain && plainCandidates.length !== selection.plainGzipCount) throw Error("Incomplete plain gzip tile selection");
  if (deltaCandidates.length !== selection.candidateCount || inventory.digest("hex") !== selection.candidateInventorySha256) {
    console.log("Tile inventory changed. Keeping the original offline representations.");
    return;
  }

  const gzip = (await import("./offline-gzip")).openOfflineGzip();
  if (mode === "gzip" && !gzip) {
    console.log("libdeflate unavailable. Keeping original offline tile bytes.");
    return;
  }
  const descriptors = new Map<string, Asset>();
  // Plain packets in the pinned inventory retain their exact JSON representation in both packages.
  const deltaAssets = new Set(mode === "compact" ? deltaCandidates : []);
  const candidates = gzip ? [...deltaCandidates, ...plainCandidates] : deltaCandidates;
  let saved = 0;
  for (const asset of candidates) {
    const path = join(destination, asset.url);
    const encoded = readFileSync(join(source, asset.url));
    if (encoded.length !== asset.bytes || hash(encoded) !== asset.sha256) throw Error("Invalid source: " + asset.url);
    const raw = gunzipSync(encoded);
    if (raw.length !== asset.decodedBytes) throw Error("Invalid source size: " + asset.url);
    if (gzip && !deltaAssets.has(asset)) {
      const data = gzip.compress(raw);
      if (data.length >= encoded.length) continue;
      if (!gunzipSync(data).equals(raw)) throw Error("Offline gzip failed its full source-byte round trip: " + asset.url);
      saved += encoded.length - data.length;
      replaceFile(path, data);
      descriptors.set(asset.url, { ...asset, bytes: data.length, sha256: hash(data) });
      continue;
    }
    const result = await compactTile(raw, gzip?.compress);
    if (!result || result.data.length >= encoded.length) continue;
    saved += encoded.length - result.data.length;
    replaceFile(path, result.data);
    descriptors.set(asset.url, { ...asset, bytes: result.data.length, decodedBytes: result.decodedBytes,
      sha256: hash(result.data), deltaDecodedBytes: raw.length });
  }
  gzip?.close();
  // Preserve the original manifest's exact metadata and number spellings as well.
  for (const asset of candidates) Object.assign(asset, descriptors.get(asset.url));
  const replaced = new Set<string>();
  const updated = originalManifest.replace(/\{[^{}]*"url"\s*:\s*"[^"]+\.json\.gz"[^{}]*\}/g, text => {
    const asset = descriptors.get(JSON.parse(text).url);
    if (!asset || replaced.has(asset.url)) return text;
    replaced.add(asset.url);
    return JSON.stringify(asset);
  });
  if (replaced.size !== descriptors.size || !isDeepStrictEqual(JSON.parse(updated), manifest)) {
    throw Error("Incomplete offline delta manifest");
  }
  replaceFile(join(destination, "manifest.json"), updated);
  console.log(`${replaced.size} byte-verified offline ${mode} tiles saved ${saved} bytes before ZIP compression.`);
}
if (import.meta.main) await main();
