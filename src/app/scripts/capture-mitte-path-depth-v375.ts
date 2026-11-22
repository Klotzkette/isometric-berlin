/** Export the actual core and Worker way/lawn surfaces for the offline visibility audit. */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Color, Mesh } from "three";
import {
  createIsometricCityCoreStepsV309,
  createSmoothSurfaces,
  ISO_GROUND_SHADES,
} from "../src/IsometricCityWorld";
import { surfaceFamilyPayload, splitParkSurfaceFamily } from "../src/progressiveWorld";
import { smoothGroundTopSampler } from "../src/terrainPayload";
import { restoreRoadGroundV343 } from "../src/RoadGroundV343";
import { createKulturforumPlazaV343 } from "../src/KulturforumPlazaV343";
import { restoreTiergartenPathsV345 } from "../src/TiergartenPathsV345";
import { attachMittePlazaEdgesV367 } from "../src/MittePlazaEdgesV367";
import { createRestoredRoadBatch, RESTORED_ROAD_MAX_LINE_CHARS } from "../src/restoredRoadSurfaces";
import { readRoadWordBatch, readRoadWordRecord, ROAD_PLANES_ENCODING } from "../src/roadWordPlanesV362";
import { decodeLosslessGzipJson } from "../src/losslessGzipBase85";
import { spreebogenTerrainYAt } from "../src/spreebogenBankProfile";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import scene from "../public/mesh/regierungsviertel/scene.json";

const outputDirectory = process.argv[2];
if (!outputDirectory) throw Error("Pass an output directory for the generated offline capture");
await mkdir(outputDirectory, { recursive: true });
const filename = (base: string) => join(outputDirectory, base);
const grass = ISO_GROUND_SHADES.grass.map((hex) => new Color(hex));
const slabs: number[] = [];
let captured = false;
const core = createIsometricCityCoreStepsV309(prisms, ground, scene.tiergartentunnel, surfaces, {
  buildings: [],
  smoothSurfaces: null,
  retainRasterAsphalt: false,
  invalidenGroundV371: true,
  restoreRoadGroundV343: function* (mesh, source) {
    restoreRoadGroundV343(mesh, source, createKulturforumPlazaV343(source));
    restoreTiergartenPathsV345(mesh, source, surfaces);
    yield* attachMittePlazaEdgesV367(mesh, source, ISO_GROUND_SHADES);
    const matrices = mesh.instanceMatrix.array;
    const colours = mesh.instanceColor!.array;
    for (let instance = 0; instance < mesh.count; instance++) {
      const offset = 16 * instance;
      const width = matrices[offset];
      if (width <= 0 || matrices[offset + 5] !== 3 || matrices[offset + 10] !== 4) continue;
      const rgb = 3 * instance;
      const isGrass = grass.some(
        (colour) =>
          Math.abs(colour.r - colours[rgb]) < 1e-6 &&
          Math.abs(colour.g - colours[rgb + 1]) < 1e-6 &&
          Math.abs(colour.b - colours[rgb + 2]) < 1e-6,
      );
      if (!isGrass) continue;
      const centreX = matrices[offset + 12];
      const centreZ = matrices[offset + 14];
      const elevation = matrices[offset + 13] + 1.5;
      slabs.push(centreX - width / 2, centreZ - 2, centreX + width / 2, centreZ + 2, elevation);
    }
    captured = true;
    yield;
  },
});
while (!captured && !core.next().done) {
  /* Exhaust through the real ground callback. */
}
core.return(undefined!);
if (!captured) throw Error("Missing original ground");
await Bun.write(filename("slabs.f32"), new Float32Array(slabs));
const sample = smoothGroundTopSampler(ground);
const terrain = (x: number, z: number) =>
  sample(x / ground.cell_m - ground.grid.min_x_idx, z / ground.cell_m - ground.grid.min_z_idx);
const water = ground.water_top_y_m ?? 0;
const records = [];
const groups = [
  ...(["sand", "earth"] as const).map((kind) => [kind, surfaceFamilyPayload(surfaces, kind)] as const),
  ...splitParkSurfaceFamily(surfaces).map((payload, i) => ["park" + i, payload] as const),
];
for (const [id, payload] of groups) {
  const root = createSmoothSurfaces(payload, water, water + 5.35, terrain, {
    excludeDistrictMarkings: true,
    parliamentaryDiningV296: true,
    waterfrontV296: true,
    invalidenGroundV371: true,
  });
  for (const surface of root.children) {
    if (
      !(surface instanceof Mesh) ||
      ![
        "smooth park paths",
        "smooth earth desire paths",
        "smooth parkland lawns",
        "smooth garden beds",
      ].includes(surface.name)
    )
      continue;
    const key = id + (surface.name === "smooth garden beds" ? "-bed" : "-top");
    const positions = surface.geometry.attributes.position,
      indices = surface.geometry.index;
    const faces = indices
      ? Uint32Array.from(indices.array)
      : Uint32Array.from({ length: positions.count }, (_, i) => i);
    await Bun.write(filename(key + ".xyz"), new Float32Array(positions.array));
    await Bun.write(filename(key + ".tri"), faces);
    records.push({
      key,
      id,
      name: surface.name,
      vertices: positions.count,
      triangles: faces.length / 3,
    });
  }
}
await Bun.write(filename("records.json"), JSON.stringify(records));
const lines = (
  await Bun.file(join(import.meta.dir, "../src/data/restoredRoadSurfaces.ndjson.txt")).text()
)
  .trimEnd()
  .split("\n");
const header = JSON.parse(lines[0]);
const blocks = [];
const positions = [];
const triangles = [];
let vertexCount = 0;
let faceCount = 0;
for (const line of lines.slice(1)) {
  const value =
    header.encoding === "ndjson-gzip-base85-json"
      ? decodeLosslessGzipJson(line, RESTORED_ROAD_MAX_LINE_CHARS)
      : JSON.parse(line);
  const packed =
    header.encoding === ROAD_PLANES_ENCODING
      ? readRoadWordRecord(value, RESTORED_ROAD_MAX_LINE_CHARS)
      : null;
  if ((packed ?? value).kind !== "paving") continue;
  const batch = packed ? readRoadWordBatch(packed) : value;
  const surface = createRestoredRoadBatch(
    batch,
    (x, z) => spreebogenTerrainYAt(x, z, terrain(x, z)),
    true,
  ).children[0] as Mesh;
  const positionsAttribute = surface.geometry.attributes.position;
  const index = Uint32Array.from(surface.geometry.index!.array);
  blocks.push({
    id: batch.id,
    v: vertexCount,
    faces: faceCount,
    count: positionsAttribute.count,
    tri: index.length / 3,
  });
  positions.push(
    Buffer.from(
      positionsAttribute.array.buffer,
      positionsAttribute.array.byteOffset,
      positionsAttribute.array.byteLength,
    ),
  );
  for (let i = 0; i < index.length; i++) index[i] += vertexCount;
  triangles.push(Buffer.from(index.buffer));
  vertexCount += positionsAttribute.count;
  faceCount += index.length / 3;
}
await Bun.write(filename("paved-top.xyz"), Buffer.concat(positions));
await Bun.write(filename("paved-top.tri"), Buffer.concat(triangles));
await Bun.write(filename("paved-blocks.json"), JSON.stringify(blocks));
console.log(
  `Captured ${slabs.length / 5} green slab runs, ${records.length} park/path meshes and ${blocks.length} paving batches`,
);
