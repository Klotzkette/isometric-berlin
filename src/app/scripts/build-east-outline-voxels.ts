import { Color, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { sourceMesh } from "../src/BebelplatzBuildingShells";
import { createFernsehturmOutlineMesh } from "../src/FernsehturmOutlineGeometry";
import {
  SCHLOSS_EAST_SOURCE as source, SCHLOSS_EAST_PROFILE_KEYS, SCHLOSS_EAST_TONES, FERNSEHTURM_PROFILE,
} from "../src/schlossEastProfile";

type Block = { p: [number, number, number]; color: number };
export const EAST_OUTLINE_SAMPLING = { cell_m: 2, max_triangle_sample_edge_m: 1.25 } as const;

/** Original deterministic surface algorithm; run once offline, never on a phone. */
function voxelSurface(mesh: Mesh, cells: Map<string, Block>): void {
  const positions = mesh.geometry.getAttribute("position"), colors = mesh.geometry.getAttribute("color");
  const colour = new Color(), cell = EAST_OUTLINE_SAMPLING.cell_m;
  for (let i = 0; i < positions.count; i += 3) {
    const p = [0, 1, 2].map(j => [positions.getX(i+j), positions.getY(i+j), positions.getZ(i+j)]);
    const longest = Math.max(...[0, 1, 2].map(j => Math.hypot(...p[j].map((v,k) => v-p[(j+1)%3][k]))));
    const n = Math.max(1, Math.ceil(longest / EAST_OUTLINE_SAMPLING.max_triangle_sample_edge_m));
    colour.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
    for (let u = 0; u <= n; u++) for (let v = 0; v <= n-u; v++) {
      const point = p[0].map((a,k) => Math.floor((a + (p[1][k]-a)*u/n + (p[2][k]-a)*v/n)/cell)*cell + cell/2) as Block["p"];
      const key = point.join(",");
      if (!cells.has(key)) cells.set(key, { p: point, color: colour.getHex() });
    }
  }
}

/** Preserve insertion order and first-source colour ownership exactly. */
export function buildEastOutlineVoxels() {
  const cells = new Map<string, Block>();
  const profiles: { key: typeof SCHLOSS_EAST_PROFILE_KEYS[number]; first_cell: number; added_cells: number; part_ids: string[] }[] = [];
  for (const key of SCHLOSS_EAST_PROFILE_KEYS) {
    const profile = source.profiles[key], first = cells.size;
    const mesh = key === "fernsehturm" ? createFernsehturmOutlineMesh() : sourceMesh(profile.parts, SCHLOSS_EAST_TONES[key]);
    voxelSurface(mesh, cells);
    mesh.geometry.dispose();
    (mesh.userData.dayMaterial as MeshBasicMaterial).dispose();
    (mesh.userData.nightMaterial as MeshStandardMaterial).dispose();
    profiles.push({ key, first_cell: first, added_cells: cells.size - first, part_ids: profile.parts.map(p => p.id) });
  }
  const palette: number[] = [], colourIds = new Map<number, number>(), packed: number[] = [];
  for (const { p, color } of cells.values()) {
    let index = colourIds.get(color);
    if (index === undefined) { index = palette.length; palette.push(color); colourIds.set(color, index); }
    // Coordinates are lossless integer 2 m grid indices. Antenna courses retain
    // their original fractional published-height coordinates at runtime.
    packed.push(...p.map(v => (v - EAST_OUTLINE_SAMPLING.cell_m / 2) / EAST_OUTLINE_SAMPLING.cell_m), index);
  }
  return {
    format: "isometric-berlin-east-outline-voxels", schema_version: 1,
    source_sha256: new Bun.CryptoHasher("sha256").update(JSON.stringify(source)).digest("hex"),
    display_profile_sha256: new Bun.CryptoHasher("sha256").update(JSON.stringify(FERNSEHTURM_PROFILE)).digest("hex"),
    sampling: EAST_OUTLINE_SAMPLING,
    cell_count: cells.size, profiles, palette,
    cells_i32: packed,
  };
}

if (import.meta.main) {
  const payload = buildEastOutlineVoxels();
  const target = `${import.meta.dir}/../src/eastOutlineVoxelData.json`;
  await Bun.write(target, JSON.stringify(payload) + "\n");
  console.log(`Prepared ${payload.cell_count.toLocaleString()} exact cells, ${payload.palette.length} colours: ${Bun.file(target).size.toLocaleString()} bytes`);
}
