import { BufferAttribute, Group, InstancedMesh, LineSegments, Material, Mesh } from "three";
import source from "../../public/mesh/regierungsviertel/lod2-prisms.json";
import { createDistantBuildingShells, createIsometricCityCore, type PrismBuilding, type PrismPayload } from "../../src/IsometricCityWorld";
import { buildColumnToneLookup, createMinecraftVoxelWorld, type VoxelPayload } from "../../src/MinecraftVoxelWorld";

export const coreSourceV211 = source as unknown as PrismPayload;
export const sourceIdsV211 = ["ilN3ccbn", "gi6ByK1f", "Ht000054", "E397kXL5"];
export const nativeIdsV211 = [...sourceIdsV211, "10895838", "gCPv6VJo", "99MFTlRq", "v211-neutral", "v211-coloured"];
export const fixtureV211 = (id: string, index = 0): PrismBuilding => ({
  id, class: 0, y0_dm: 40, h_dm: 180, roof: 1000,
  tone: id === "v211-coloured" ? [210, 40, 20] : [168, 166, 160],
  ring: [[80000 + index * 80, 80000], [80040 + index * 80, 80000], [80040 + index * 80, 80040], [80000 + index * 80, 80040]],
});
export function drawnV211(part: PrismBuilding, pass: "distant" | "detailed"): Group {
  const payload: PrismPayload = { schema_version: 1, classes: ["concrete"], buildings: [part] };
  return pass === "distant" ? createDistantBuildingShells(payload, [part])
    : createIsometricCityCore(payload, null, null, null, { includeContext: false });
}
export function nativeV211(profile: "full" | "mobile"): Group {
  const parts = nativeIdsV211.map(fixtureV211);
  const payload: VoxelPayload = {
    schema_version: 1, cell_m: 4, classes: ["concrete"],
    grid: { cols: parts.length * 2, rows: 1, min_x_idx: 2000, min_z_idx: 2000 },
    ground_height: { cols: parts.length * 2, rows: 1, stride_cells: 1, y_dm: Array(parts.length * 2).fill(40) },
    ground_rows: [], buildings: parts.map((_, i) => [2000 + i * 2, 2000, 40, 220, 0]), trees: [], water_top_y_m: 3,
  };
  return createMinecraftVoxelWorld(payload, buildColumnToneLookup({ buildings: parts }), null, { detailProfile: profile });
}
export function attributeDigestV211(attribute: BufferAttribute | null): string | null {
  return attribute ? new Bun.CryptoHasher("sha256")
    .update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)).digest("hex") : null;
}
export function snapshotV211(root: Group) {
  const geometry: unknown[] = [], colours: unknown[] = [];
  let bytes = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    const g = object.geometry;
    const attributes = Object.entries(g.attributes).map(([name, value]) => {
      bytes += value.array.byteLength;
      return [name, value.count, value.itemSize, value.normalized, name === "color" ? null : attributeDigestV211(value as BufferAttribute)];
    });
    bytes += g.index?.array.byteLength ?? 0;
    geometry.push([object.name, attributes, attributeDigestV211(g.index), object.matrix.toArray()]);
    colours.push([object.name, attributeDigestV211(g.getAttribute("color") as BufferAttribute)]);
    if (object instanceof InstancedMesh) {
      bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
      geometry.push([object.name, object.count, attributeDigestV211(object.instanceMatrix), object.instanceColor?.array.byteLength ?? 0]);
      colours.push([object.name, attributeDigestV211(object.instanceColor)]);
    }
  });
  const hash = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
  // Instanced meshes have a geometry record and a separate instance record.
  return { geometry: hash(geometry), colours: hash(colours), bytes, bufferRecords: colours.length };
}
export function wallColoursV211(root: Group, floor: number): string[] {
  const mesh = root.children.find(object => object instanceof Mesh) as Mesh;
  const p = mesh.geometry.getAttribute("position"), c = mesh.geometry.getAttribute("color").array;
  const tones = new Set<string>();
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - floor) < 1e-4)
    tones.add(Array.from(c.slice(i * 3, i * 3 + 3)).join(","));
  return [...tones].sort();
}
export function disposeV211(root: Group): void {
  const materials = new Set<Material>();
  root.traverse(object => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    object.geometry.dispose();
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
    for (const m of Object.values(object.userData)) if (m instanceof Material) materials.add(m);
    if (object instanceof InstancedMesh) object.dispose();
  });
  for (const material of materials) material.dispose();
  root.clear();
}
