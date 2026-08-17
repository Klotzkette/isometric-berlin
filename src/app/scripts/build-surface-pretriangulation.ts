import {
  createPretriangulatedSurfacePlate,
  type PretriangulatedSurfaceKind,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import {
  encodeSurfacePlate,
  SURFACE_PLATE_MANIFEST_FILE,
  type SurfacePlateManifest,
} from "../src/surfacePlate";

const meshRoot = `${import.meta.dir}/../public/mesh/regierungsviertel`;
const sourcePath = `${meshRoot}/surface-polygons.json`;
const sourceBytes = new Uint8Array(await Bun.file(sourcePath).arrayBuffer());
const payload = JSON.parse(new TextDecoder().decode(sourceBytes)) as SurfacePayload;
// JSON's insignificant `5.0` versus `5` spelling must not invalidate an
// otherwise identical data contract in the browser, which hashes the parsed
// payload it already owns. Canonical insertion-order JSON binds the plate to
// every value/key while staying reproducible on both sides.
const canonicalSource = JSON.stringify(payload);
const sourceSha256 = new Bun.CryptoHasher("sha256")
  .update(canonicalSource)
  .digest("hex");

const plates: SurfacePlateManifest["plates"] = [];
// Asphalt is the pathological 2,566-hole union (5.38 s Earcut and multi-GiB
// transient memory on the production payload). Paving is already partitioned
// upstream and remains a bounded Worker-only task; committing its 4.70 MiB
// plate would leave the 240 MiB offline package with too little release
// headroom for required attribution assets.
for (const kind of ["asphalt"] as const satisfies readonly PretriangulatedSurfaceKind[]) {
  const polygons = (payload.roads ?? []).filter((road) => road.kind === kind);
  const geometry = createPretriangulatedSurfacePlate(polygons);
  if (!geometry) {
    throw new Error(`No ${kind} geometry was produced`);
  }
  const raw = encodeSurfacePlate(kind, geometry);
  const compressed = Bun.gzipSync(raw, { level: 9 });
  const file = `surface-${kind}-${sourceSha256.slice(0, 12)}.plate.gz`;
  await Bun.write(`${meshRoot}/${file}`, compressed);
  plates.push({
    compressed_bytes: compressed.byteLength,
    file,
    index_count: geometry.getIndex()?.count ?? 0,
    kind,
    raw_bytes: raw.byteLength,
    vertex_count: geometry.getAttribute("position").count,
  });
  geometry.dispose();
}

const manifest: SurfacePlateManifest = {
  format: "isometric-berlin-surface-plate",
  schema_version: 1,
  source_file: "surface-polygons.json",
  source_sha256: sourceSha256,
  stage: "post-earcut-pre-terrain-drape",
  plates,
};
await Bun.write(
  `${meshRoot}/${SURFACE_PLATE_MANIFEST_FILE}`,
  `${JSON.stringify(manifest, null, 2)}\n`,
);

for (const plate of plates) {
  console.log(
    `${plate.kind}: ${plate.vertex_count.toLocaleString()} vertices, ` +
      `${plate.index_count.toLocaleString()} indices, ` +
      `${(plate.compressed_bytes / 1024 / 1024).toFixed(2)} MiB gzip`,
  );
}
