import { describe, expect, test } from "bun:test";
import { Color, InstancedMesh, Raycaster, Vector3 } from "three";
import data from "../src/eastOutlineVoxelData.json";
import { createSchlossEastOutlines } from "../src/SchlossEastOutlines";
import { SCHLOSS_EAST_SOURCE as source, SCHLOSS_EAST_PROFILE_KEYS,
  SCHLOSS_EAST_TONES, SCHLOSS_EAST_PARTS, FERNSEHTURM_ANTENNA,
  FERNSEHTURM_PROFILE as TV, fernsehturmOutlineSolidAt } from "../src/schlossEastProfile";
import { buildEastOutlineVoxels } from "../scripts/build-east-outline-voxels";
import { createFernsehturmOutlineMesh } from "../src/FernsehturmOutlineGeometry";
import { ALEXANDER_STATIONS_V183_HALL_PART_IDS } from "../src/alexanderStationsV183Profile";

function arrayHash(matrix: Float32Array, color: Float32Array): string {
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(new Uint8Array(matrix.buffer));
  hash.update(new Uint8Array(color.buffer));
  return hash.digest("hex");
}

// Independently reconstruct the unchanged historical prepared buffers. Their
// existing hash remains authoritative; v183 delegates only one exact range.
const antennaCount = Math.ceil((FERNSEHTURM_ANTENNA.top - FERNSEHTURM_ANTENNA.base) / 2);
const originalMatrices = new Float32Array((data.cell_count + antennaCount) * 16);
const originalColors = new Float32Array((data.cell_count + antennaCount) * 3);
const color = new Color();
const put = (i: number, x: number, y: number, z: number, hex: number) => {
  for (const diagonal of [0, 5, 10, 15]) originalMatrices[i * 16 + diagonal] = 1;
  originalMatrices.set([x, y, z], i * 16 + 12);
  color.setHex(hex).toArray(originalColors, i * 3);
};
for (let i = 0; i < data.cell_count; i++) {
  const [x, y, z, c] = data.cells_i32.slice(i * 4, i * 4 + 4), cell = data.sampling.cell_m;
  put(i, x * cell + cell / 2, y * cell + cell / 2, z * cell + cell / 2, data.palette[c]);
}
for (let i = 0; i < antennaCount; i++) {
  const mast = FERNSEHTURM_ANTENNA, y = mast.base + i * 2;
  put(data.cell_count + i, mast.x, Math.min(y + 1, mast.top - 1), mast.z,
    Math.floor((y - mast.base) / 10) % 2 ? 0xd4d6cb : 0xa36254);
}

describe("lossless offline eastern outline surface cache", () => {
  test("v183 delegates the exact station hall while retaining the complete station base", () => {
    const keys = ["stationBase", "stationHall"] as const;
    const drawn = createSchlossEastOutlines(false, keys);
    expect(drawn.userData.sourcePartCount).toBe(source.profiles.stationBase.parts.length);
    expect(drawn.userData.profiles).toEqual(["stationBase"]);
    expect(drawn.children.length).toBe(2);
    expect(source.profiles.stationHall.parts.every(p => ALEXANDER_STATIONS_V183_HALL_PART_IDS.has(p.id))).toBeTrue();
    expect(drawn.children.every(child => child.name.includes("Alexanderplatz station"))).toBeTrue();
    const all = createSchlossEastOutlines(true).children[0] as InstancedMesh;
    const station = createSchlossEastOutlines(true, keys).children[0] as InstancedMesh;
    const first = data.profiles.find(p => p.key === "stationBase")!.first_cell;
    expect(station.count).toBe(data.profiles.find(p => p.key === "stationBase")!.added_cells);
    expect(station.instanceMatrix.array).toEqual(all.instanceMatrix.array.slice(first*16, (first+station.count)*16));
    expect(station.instanceColor!.array).toEqual(all.instanceColor!.array.slice(first*3, (first+station.count)*3));
  });
  test("prepared cells exactly reproduce the original source-surface algorithm", () => {
    expect(buildEastOutlineVoxels()).toEqual(data);
    expect(data.source_sha256).toBe(new Bun.CryptoHasher("sha256").update(JSON.stringify(source)).digest("hex"));
    expect(data.display_profile_sha256).toBe(new Bun.CryptoHasher("sha256").update(JSON.stringify(TV)).digest("hex"));
    expect(data.profiles.map(p => p.key)).toEqual([...SCHLOSS_EAST_PROFILE_KEYS]);
    expect(data.profiles.map(p => p.part_ids)).toEqual(SCHLOSS_EAST_PROFILE_KEYS.map(k => source.profiles[k].parts.map(p => p.id)));
    expect(Object.keys(SCHLOSS_EAST_TONES)).toEqual([...SCHLOSS_EAST_PROFILE_KEYS]);
    expect(SCHLOSS_EAST_PARTS.length).toBe(8);
  });
  test("palette and integer grid retain every exposed cell without duplicate fill", () => {
    expect(data.cell_count).toBe(21010);
    expect(data.palette.length).toBe(67);
    expect(data.cells_i32.length).toBe(data.cell_count * 4);
    expect(data.cells_i32.every(Number.isInteger)).toBeTrue();
    const keys = new Set<string>();
    for (let i = 0; i < data.cells_i32.length; i += 4) {
      const [x, y, z, colour] = data.cells_i32.slice(i, i + 4);
      keys.add(`${x},${y},${z}`);
      expect(colour).toBeGreaterThanOrEqual(0); expect(colour).toBeLessThan(data.palette.length);
    }
    expect(keys.size).toBe(data.cell_count);
  });
  test("station and Rathaus cells stay byte-identical while the generalized TV cylinder is resolved", () => {
    const firstTower = data.profiles.find(p => p.key === "fernsehturm")!.first_cell;
    expect(firstTower).toBe(16386);
    expect(new Bun.CryptoHasher("sha256").update(JSON.stringify(data.cells_i32.slice(0, firstTower * 4))).digest("hex"))
      .toBe("acb29d82db61681884ec6e36fe0f24194b031ccacda4de90425ef5f42a028417");
    expect(TV.sphereRadius * 2).toBe(32);
    expect(TV.totalHeight).toBe(368);
    expect(FERNSEHTURM_ANTENNA.top - TV.groundY).toBe(368);
    expect(FERNSEHTURM_ANTENNA.top - FERNSEHTURM_ANTENNA.base).toBe(118);
    expect(fernsehturmOutlineSolidAt(TV.x + 12, TV.z, TV.groundY + 100)).toBeFalse();
    expect(fernsehturmOutlineSolidAt(TV.x + 12, TV.z, TV.groundY + TV.sphereCenterHeight)).toBeTrue();
  });
  for (const minecraft of [false, true]) test(`sphere is visibly wider than the narrow shaft (${minecraft})`, () => {
    const root = minecraft ? createSchlossEastOutlines(true) : createFernsehturmOutlineMesh();
    root.updateMatrixWorld(true);
    const visibleRadius = (height: number): number => {
      const hits = new Raycaster(new Vector3(TV.x - 25, TV.groundY + height, TV.z), new Vector3(1, 0, 0), 0, 50)
        .intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0);
      return 25 - hits[0].distance;
    };
    const sphere = visibleRadius(TV.sphereCenterHeight), shaft = visibleRadius(100);
    expect(sphere).toBeGreaterThan(14); expect(sphere).toBeLessThan(18);
    expect(shaft).toBeGreaterThan(4); expect(shaft).toBeLessThan(9);
    expect(sphere).toBeGreaterThan(shaft * 1.6);
  });
  for (const device of ["full", "mobile"]) test(`${device} retains the prepared native silhouette byte for byte`, () => {
    // Both world profiles intentionally use this identical native constructor.
    const root = createSchlossEastOutlines(true), mesh = root.children[0] as InstancedMesh;
    expect(root.children.length).toBe(1);
    expect(mesh instanceof InstancedMesh).toBeTrue();
    const hall = data.profiles.find(p => p.key === "stationHall")!;
    expect(arrayHash(originalMatrices, originalColors)).toBe("a952a714d2b317e0447c3f1609834a0fd0cb715d76888c7045feda6ac73312ce");
    expect(mesh.count).toBe(data.cell_count - hall.added_cells + antennaCount);
    const retained = (buffer: Float32Array, stride: number) => new Float32Array([
      ...buffer.subarray(0, hall.first_cell * stride),
      ...buffer.subarray((hall.first_cell + hall.added_cells) * stride),
    ]);
    expect(mesh.instanceMatrix.array).toEqual(retained(originalMatrices, 16));
    expect(mesh.instanceColor!.array).toEqual(retained(originalColors, 3));
    expect(mesh.geometry.attributes.position.count).toBe(24);
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBe(mesh.count * 19 * 4);
    expect(root.userData.hiddenSolidInfill).toBeFalse();
  });
});
