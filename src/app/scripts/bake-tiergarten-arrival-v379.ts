// Run with Bun from any directory. Everything is derived from the retained Berlin model.
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  treeBarkTone,
  treeFoliageTone,
  treePresentationForm,
  decodeTrees,
} from "../src/ParkDetails";
import {
  withCanopyParkV376,
  withCanopyVoxelsV376,
} from "../src/MitteCanopyV376";
import { earlyMitteTreeStandsV375 } from "../src/MitteTreesV375";
import { createTunnelPortalApproachTester } from "../src/TunnelPortals";
import { isChancelleryExtensionConstructionPoint } from "../src/chancelleryExtensionProfile";
import { isHolocaustMinecraftProtectedAt } from "../src/holocaustField";
import {
  forEachVoxelTreeBlock,
  minecraftVoxelTreeRetained,
} from "../src/terrainPayload";
import {
  inPotsdamerPanoramaLandscape,
  POTSDAMER_PANORAMA_LANDSCAPE,
} from "../src/potsdamerPanoramaPalette";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const mesh = root + "src/app/public/mesh/regierungsviertel/";
const out = root + "src/app/src/data/";
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const gpkg = new Database(root + "geo_data/regierungsviertel/osm.gpkg", {
  readonly: true,
});
const park = gpkg
  .query("SELECT geom FROM parks WHERE element='relation' AND id='7643526'")
  .get() as { geom: Uint8Array };
gpkg.close();
// GeoPackage 1.3, XY envelope, EPSG:25833, followed by a 2D little-endian OGC MultiPolygon.
const bytes = Buffer.from(park.geom);
if (
  bytes.readUInt32LE(4) !== 25833 ||
  bytes[3] !== 3 ||
  bytes[40] !== 1 ||
  bytes.readUInt32LE(41) !== 6
)
  throw Error("Unexpected Tiergarten geometry");
let at = 45;
const uint = () => {
  const n = bytes.readUInt32LE(at);
  at += 4;
  return n;
};
const number = () => {
  const n = bytes.readDoubleLE(at);
  at += 8;
  return n;
};
type XY = [number, number];
const polygons: XY[][][] = [];
for (let p = uint(); p > 0; p--) {
  if (bytes[at++] !== 1 || uint() !== 3) throw Error("Expected polygon");
  const rings: XY[][] = [];
  for (let r = uint(); r > 0; r--) {
    const vertices: XY[] = [];
    for (let n = uint(); n > 0; n--)
      vertices.push([number() - 389500, 5820000 - number()]);
    rings.push(vertices);
  }
  polygons.push(rings);
}
if (at !== bytes.length) throw Error("Partial park boundary");
function inside(x: number, z: number, ring: XY[]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
const within = (x: number, z: number) =>
  polygons.some(
    ([outer, ...holes]) =>
      inside(x, z, outer) && !holes.some((h) => inside(x, z, h)),
  );
const parse = (f: string) => JSON.parse(readFileSync(mesh + f, "utf8"));
const native = withCanopyVoxelsV376(parse("minecraft-voxels.json"));
const drawn = withCanopyParkV376(parse("park-details.json"));
const tunnel = parse("scene.json").tiergartentunnel;
const approach = createTunnelPortalApproachTester(tunnel);
const nativeApproach = createTunnelPortalApproachTester(tunnel, 4 / Math.SQRT2);
const legacy = new Set(
  earlyMitteTreeStandsV375()
    .flat()
    .map((t) => t.id),
);
const styles: number[][] = [];
const styleMap = new Map<string, number>();
function style(
  shape: number,
  leaves: number,
  bark: number,
  stemPercent: number,
  variant = 0,
) {
  const row = [shape, leaves, bark, stemPercent, variant],
    key = row.join(",");
  let index = styleMap.get(key);
  if (index === undefined) {
    index = styles.length;
    styles.push(row);
    styleMap.set(key, index);
  }
  return index;
}
type Row = {
  x: number;
  y: number;
  z: number;
  h: number;
  cr: number;
  tr: number;
  style: number;
  legacy: boolean;
  family: number;
  mobile: boolean;
};
const rows: Row[] = [];
const sources: Record<string, number> = {};
for (const t of decodeTrees(drawn.trees, drawn.tree_vocabulary)) {
  const [x, y, z] = t.position;
  if (
    !within(x, z) ||
    isChancelleryExtensionConstructionPoint(x, z) ||
    approach(x, z, t.crown_radius_m + 1.5)
  )
    continue;
  const form = treePresentationForm(t);
  const shape = ["fir", "pine", "conifer"].includes(form) ? 1 : 0;
  const ratio = {
    airy: 58,
    broadleaf: 50,
    columnar: 56,
    conifer: 54,
    dense: 48,
    fir: 54,
    oak: 45,
    orchard: 50,
    pine: 67,
    shrub: 24,
    spreading: 44,
    vase: 46,
    willow: 48,
  }[form];
  rows.push({
    x,
    y,
    z,
    h: t.height_m,
    cr: t.crown_radius_m,
    tr:
      t.trunk_radius_m ??
      Math.max(
        form === "shrub" ? 0.1 : 0.18,
        t.crown_radius_m * (form === "shrub" ? 0.055 : 0.095),
      ),
    style: style(
      shape,
      treeFoliageTone(t),
      treeBarkTone(t),
      ratio,
      t.variant % 12,
    ),
    legacy: legacy.has(t.id),
    family: 0,
    mobile: true,
  });
  sources[t.source ?? "unknown"] = (sources[t.source ?? "unknown"] ?? 0) + 1;
}
forEachVoxelTreeBlock(native, (cx, cz, y, h) => {
  const x = cx * 4 + 2,
    z = cz * 4 + 2;
  if (
    !within(x, z) ||
    isChancelleryExtensionConstructionPoint(x, z) ||
    isHolocaustMinecraftProtectedAt(x, z, 4.4) ||
    nativeApproach(x, z, 4.4) ||
    !minecraftVoxelTreeRetained(cx, cz, "full", native.retainSurveyTree)
  )
    return;
  const species = Math.abs(cx * 7 + cz * 13) % 5;
  const shades = inPotsdamerPanoramaLandscape(x, z)
    ? POTSDAMER_PANORAMA_LANDSCAPE.foliage
    : [0x4c7f28, 0x5d9634];
  const shade = (salt: number) =>
    shades[Math.abs(cx * 31 + cz * 17 + salt * 7) % shades.length];
  rows.push({
    x,
    y: y / 10,
    z,
    h: Math.max(4, h / 10),
    cr: 4.4,
    tr: 0.9,
    style: style(
      species === 1 || species === 3 ? 3 : 2,
      shade(2),
      species === 0 ? 0xd6dfe0 : 0x704a2d,
      shade(3),
    ),
    legacy: false,
    family: 1,
    mobile: minecraftVoxelTreeRetained(
      cx,
      cz,
      "mobile",
      native.retainSurveyTree,
    ),
  });
});
// One actual tree, with its own dimensions, in each occupied 36 m square. Give
// mobile-compatible native trees priority so this first stand works for both profiles.
const seed = new Map<string, Row>();
for (const row of rows) {
  const id = [row.family, Math.floor(row.x / 36), Math.floor(row.z / 36)].join(
    ",",
  );
  const prev = seed.get(id);
  if (
    !prev ||
    (+row.mobile - +prev.mobile || row.h * row.cr - prev.h * prev.cr) > 0
  )
    seed.set(id, row);
}
const first = new Set(seed.values());
function packet(input: Row[]) {
  const blocks = new Map<string, Buffer[]>();
  for (const r of input) {
    const bx = Math.floor(r.x / 256),
      bz = Math.floor(r.z / 256);
    const key = [bx, bz, r.family, +r.legacy].join(",");
    const buf = Buffer.alloc(15);
    buf.writeUInt16LE(Math.round((r.x - bx * 256) * 100), 0);
    buf.writeUInt16LE(Math.round((r.z - bz * 256) * 100), 2);
    buf.writeInt16LE(Math.round(r.y * 1000), 4);
    buf.writeUInt16LE(Math.round(r.h * 100), 6);
    buf.writeUInt16LE(Math.round(r.cr * 100), 8);
    buf.writeUInt16LE(Math.round(r.tr * 1000), 10);
    buf.writeUInt16LE(r.style, 12);
    buf[14] = +r.mobile;
    const list = blocks.get(key) ?? [];
    list.push(buf);
    blocks.set(key, list);
  }
  return [...blocks].map(([key, list]) => [
    ...key.split(",").map(Number),
    Buffer.concat(list).toString("base64"),
  ]);
}
const initial = packet([...first]),
  extra = packet(rows.filter((r) => !first.has(r)));
const write = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value) + "\n");
write(out + "tiergartenTreeFirstV379.json", { styles, blocks: initial });
write(out + "tiergartenTreeFillV379.json", extra);
const count = (list: Row[]) => ({
  drawn: list.filter((r) => r.family === 0).length,
  nativeFull: list.filter((r) => r.family === 1).length,
  nativeMobile: list.filter((r) => r.family === 1 && r.mobile).length,
});
const result = {
  parkRelation: "https://www.openstreetmap.org/relation/7643526",
  crs: "EPSG:25833",
  geometrySha256: digest(bytes),
  sourceHashes: Object.fromEntries(
    ["park-details.json", "minecraft-voxels.json", "scene.json"].map((n) => [
      n,
      digest(readFileSync(mesh + n)),
    ]),
  ),
  sources,
  all: count(rows),
  first: count([...first]),
  fine: count(rows.filter((r) => !first.has(r))),
  nativeCellM: 4,
  firstCellM: 36,
  tileM: 256,
};
write(
  root + "geo_data/regierungsviertel/tiergarten-tree-arrival-v379.json",
  result,
);
console.log(result);
