import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { BoxGeometry, BufferGeometry, Color, EdgesGeometry, Float32BufferAttribute, Group, LineSegments, Mesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "../../src/architecturalInk";
import { createTiergartenMonuments } from "../../src/TiergartenMonuments";
import { worldGroundSampler, type VoxelPayload } from "../../src/terrainPayload";
import type { StreetDetailsPayload } from "../../src/TrafficSignals";
import receipt from "../fixtures/nationalgalerie-v221-obsolete-archer.json";
import { spliceGeometryContribution } from "./geometryContributionReplay";
import { disposeStaticAudit } from "./staticGeometryAudit";

const hash = (text: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
// Exact independently retained d7b7a3a7 recipe, before v246's sculptural detail.
const oldKoch = `function buildRobertKochMemorial(
  builder: Builder,
  x: number,
  y: number,
  z: number
): void {
  // Broad four-step marble base and inscribed pedestal.
  box(builder, STONE_LIGHT, x, y + 0.12, z, 5.0, 0.24, 4.3);
  box(builder, MARBLE, x, y + 0.34, z, 4.25, 0.22, 3.55);
  box(builder, MARBLE, x, y + 0.64, z, 3.65, 0.38, 3.0);
  box(builder, MARBLE, x, y + 1.58, z, 2.85, 1.5, 2.3);
  box(builder, STONE_LIGHT, x, y + 2.4, z, 3.15, 0.2, 2.6);
  // High-backed chair, seated coat, two separately readable legs and arms.
  box(builder, MARBLE, x, y + 3.58, z + 0.28, 2.5, 2.2, 0.5);
  box(builder, MARBLE, x, y + 3.65, z, 1.65, 1.85, 1.2);
  box(builder, MARBLE, x - 0.52, y + 3.05, z - 0.2, 0.55, 1.35, 0.75, -0.12);
  box(builder, MARBLE, x + 0.52, y + 3.05, z - 0.2, 0.55, 1.35, 0.75, 0.12);
  box(builder, MARBLE, x - 0.92, y + 3.78, z, 0.38, 1.45, 0.42, -0.35);
  box(builder, MARBLE, x + 0.92, y + 3.78, z, 0.38, 1.45, 0.42, 0.35);
  box(builder, MARBLE, x, y + 5.0, z - 0.03, 0.72, 0.82, 0.68);
}

`;
const laterRetirements = [
  '      entry.osm_key === "node/7599829392" || // v272 source-bound former-taz wall relief\n',
  '      (entry.osm_key === "way/48118825" && entry.x_dm === 8204 && entry.z_dm === 10344 &&\n' +
  '        entry.w_dm === 250 && entry.d_dm === 106 && entry.memorial_type === "sculpture" &&\n' +
  '        entry.name === "Denkmal für die Ereignisse des 17. Juni 1953") || // v281 complete glass memorial\n',
];
function proveSource(): void {
  let source = readFileSync(new URL("../../src/TiergartenMonuments.ts", import.meta.url), "utf8");
  const currentKoch = source.slice(source.indexOf("function buildRobertKochMemorial("), source.indexOf("function addGraefePediment("));
  expect(hash(currentKoch)).toBe("4da472b85aed6559d28a898e27c3bc16a1565ada2bdc3452b1d0a8c1b02dcb38");
  expect(hash(oldKoch)).toBe("88e19107a2d60f227406ff63dcce9b40babe34ded4f2c7c8d7493704fcde9c0a");
  source = source.replace(currentKoch, oldKoch);
  for (const exact of [...laterRetirements,
    '      entry.osm_key === "node/1881346242" || // v221 Calder terrace sculpture\n',
    '      entry.osm_key === "node/1881346251" || // v221 Moore bronze and circular pedestal\n',
    '    "https://bildhauerei-in-berlin.de/bildwerk/robert-koch-denkmal-7894/",\n']) {
    expect(source.split(exact)).toHaveLength(2); source = source.replace(exact, "");
  }
  const moved = 'import { type VoxelPayload, worldGroundSampler } from "./terrainPayload";';
  expect(source.split(moved)).toHaveLength(2);
  source = source.replace(moved, moved.replace("terrainPayload", "MinecraftVoxelWorld"));
  expect(hash(source)).toBe(receipt.tiergarten.source.sha256);
  for (const [name, expected] of [["street-details.json", receipt.tiergarten.source.streetSha256],
    ["minecraft-voxels.json", receipt.tiergarten.source.groundSha256]])
    expect(hash(readFileSync(new URL(`../../public/mesh/regierungsviertel/${name}`, import.meta.url)))).toBe(expected);
}
type Entry = NonNullable<StreetDetailsPayload["monuments"]>[number];
type Builder = { parts: BufferGeometry[]; edges: BufferGeometry[] };
function originalKochGeometry(entry: Entry, ground: VoxelPayload): Builder {
  const builder: Builder = { parts: [], edges: [] };
  const box = (b: Builder, color: number, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, rotation = 0) => {
    const geometry = new BoxGeometry(sx, sy, sz);
    if (rotation !== 0) geometry.rotateY(rotation);
    geometry.translate(x, y, z); geometry.deleteAttribute("uv");
    const tone = new Color(color), count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) tone.toArray(colors, i * 3);
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    b.parts.push(geometry); b.edges.push(new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES));
  };
  const x = entry.x_dm / 10, z = entry.z_dm / 10, y = worldGroundSampler(ground)(x, z);
  expect(y).not.toBeNull();
  const body = oldKoch.slice(oldKoch.indexOf("{") + 1, oldKoch.lastIndexOf("}"));
  new Function("builder", "x", "y", "z", "box", "STONE_LIGHT", "MARBLE", body)(builder, x, y, z, box, 0xb9b6ac, 0xe8e5dc);
  return builder;
}
const batch = (root: Group, protectedEntry: boolean) => protectedEntry
  ? root.getObjectByName("OSM protected memorial Day batch")! : root;
function member(root: Group, protectedEntry: boolean, name: string): Mesh | LineSegments {
  const found = batch(root, protectedEntry).children.filter(child => child.name === name);
  expect(found).toHaveLength(1); return found[0] as Mesh | LineSegments;
}

/** Restore exactly Koch v246 and the two v272/v281 retired generic markers in
 * the live merged buffers. Every other current geometry, material, transform
 * and object remains under the original v221 whole-root hashes. */
export function withTiergartenBeforeLaterChangesV281<T>(
  root: Group, street: StreetDetailsPayload, ground: VoxelPayload, inspect: () => T,
): T {
  proveSource();
  const entries = street.monuments!, temporary: Group[] = [], made: BufferGeometry[] = [];
  const saved = new Map<Mesh | LineSegments, BufferGeometry>();
  const source = (key: string) => {
    const matches = entries.filter(entry => entry.osm_key === key);
    expect(matches).toHaveLength(1); return matches[0];
  };
  const isolated = (entry: Entry) => {
    const result = createTiergartenMonuments({ ...street, monuments: [entry] }, ground);
    expect(result).not.toBeNull(); temporary.push(result!); return result!;
  };
  const change = (protectedEntry: boolean, needle: (name: string) => Group, replacement: Record<string, BufferGeometry>, mode: "replace" | "insert-before") => {
    for (const name of ["monument bodies", "monument ink lines"]) {
      const live = member(root, protectedEntry, name), part = member(needle(name), protectedEntry, name);
      if (!saved.has(live)) saved.set(live, live.geometry);
      const geometry = spliceGeometryContribution(live.geometry, part.geometry, replacement[name], mode);
      made.push(geometry); live.geometry = geometry;
    }
  };
  const keys = root.userData.externallyModelledSourceKeys;
  try {
    const koch = source("way/54672896"), currentKoch = isolated(koch);
    expect(koch.name).toBe("Robert Koch"); expect(koch.schwellenraum_protected).toBeTrue();
    const old = originalKochGeometry(koch, ground);
    const bodies = mergeGeometries(old.parts, false)!, ink = mergeGeometries(old.edges, false)!;
    made.push(bodies, ink, ...old.parts, ...old.edges);
    change(true, () => currentKoch, { "monument bodies": bodies, "monument ink lines": ink }, "replace");
    for (const [key, nextKey] of [["way/48118825", "node/6354912703"], ["node/7599829392", "node/8176222821"]]) {
      const entry = source(key), next = source(nextKey), protectedEntry = entry.schwellenraum_protected === true;
      expect(entries.indexOf(next)).toBe(entries.indexOf(entry) + 1);
      expect(next.schwellenraum_protected === true).toBe(protectedEntry);
      expect(createTiergartenMonuments({ ...street, monuments: [entry] }, ground)).toBeNull();
      // Only its suppressed identity changes; the full old name/type/location
      // and current unchanged dispatcher reproduce the original contribution.
      const previous = isolated({ ...entry, osm_key: "node/test-only-v221-retired-control" });
      // Plaques/stolpersteine intentionally have no ink. Each merged stream
      // therefore uses its own first later retained contribution as anchor.
      const following = new Map<Entry, Group | null>();
      const anchor = (name: string): Group => {
        for (let i = entries.indexOf(entry) + 1; i < entries.length; i++) {
          const candidate = entries[i];
          if ((candidate.schwellenraum_protected === true) !== protectedEntry) continue;
          if (!following.has(candidate)) {
            const made = createTiergartenMonuments({ ...street, monuments: [candidate] }, ground);
            following.set(candidate, made); if (made) temporary.push(made);
          }
          const result = following.get(candidate);
          if (result && batch(result, protectedEntry).children.some(child => child.name === name)) return result;
        }
        throw new Error(`Missing retained ${name} anchor after ${key}`);
      };
      change(protectedEntry, anchor, Object.fromEntries(["monument bodies", "monument ink lines"].map(name =>
        [name, member(previous, protectedEntry, name).geometry])), "insert-before");
    }
    expect(keys.filter((key: string) => key === "node/7599829392" || key === "way/48118825")).toHaveLength(2);
    root.userData.externallyModelledSourceKeys = keys.filter((key: string) => key !== "node/7599829392" && key !== "way/48118825");
    return inspect();
  } finally {
    root.userData.externallyModelledSourceKeys = keys;
    for (const [object, geometry] of saved) object.geometry = geometry;
    for (const geometry of made) geometry.dispose();
    for (const temporaryRoot of temporary) disposeStaticAudit(temporaryRoot);
  }
}
