import { expect, test } from "bun:test";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { CircleGeometry, DoubleSide, InstancedMesh, Mesh, MeshBasicMaterial, Raycaster, Vector3, type BufferGeometry } from "three";
import { createRestoredRoadBatch, type RestoredRoadBatch } from "../src/restoredRoadSurfaces";
import { createSmoothSurfaces, type SurfacePayload } from "../src/IsometricCityWorld";
import { cutGrosserSternGatehouseGroundSurface } from "../src/terrainPayload";
import { createSnowstorm } from "../src/SnowstormEffects";
import { inStelenfeldSite } from "../src/stelenfeldSiteV385";

const area = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) =>
  Math.abs((bx-ax)*(cz-az) - (bz-az)*(cx-ax)) / 2;
function areaXZ(g: BufferGeometry) {
  const p = g.getAttribute("position"), idx = g.index;
  let sum = 0;
  for (let i=0; i < (idx?.count ?? p.count); i+=3) {
    const a=idx?.getX(i)??i, b=idx?.getX(i+1)??i+1, c=idx?.getX(i+2)??i+2;
    sum += area(p.getX(a),p.getZ(a),p.getX(b),p.getZ(b),p.getX(c),p.getZ(c));
  }
  return sum;
}

test("the four actual streamed road packets lose exactly their intersection with the cadastral site", async () => {
  // Independent XZ polygon intersections in metres, against the original source triangles.
  const expected: Record<string, number> = { "restored-paving-0-0":287.17698, "restored-paving-0-1":1408.18793,
    "restored-paving-1-0":89.04697, "restored-paving-1-1":736.62088 };
  const source = createReadStream(new URL("../src/data/restoredRoadSurfaces.ndjson.txt", import.meta.url));
  const input = createInterface({input:source, crlfDelay:Infinity});
  const seen = new Set<string>();
  try {
    for await (const line of input) {
      if (!line.startsWith('{"id":"restored-paving-')) continue;
      const row: RestoredRoadBatch = JSON.parse(line);
      if (!(row.id in expected)) continue;
      const coords = new Float32Array(Uint8Array.from(Buffer.from(row.xz, "base64")).buffer);
      const idx = new Uint32Array(Uint8Array.from(Buffer.from(row.indices!, "base64")).buffer);
      let original = 0;
      for (let i=0; i<idx.length; i+=3) {
        const a=2*idx[i], b=2*idx[i+1], c=2*idx[i+2];
        original += area(coords[a],coords[a+1],coords[b],coords[b+1],coords[c],coords[c+1]);
      }
      const group = createRestoredRoadBatch(row, (x,z) => 4 + x*.001 + z*.0005);
      const g = (group.getObjectByName("smooth paved paths") as Mesh).geometry;
      expect(g.userData.stelenfeldPavingV385).toBeGreaterThan(0);
      expect(Math.abs(original - areaXZ(g) - expected[row.id])).toBeLessThan(.025);
      const p = g.getAttribute("position");
      for (let i=0; i<p.count; i+=19) expect(p.getY(i)).toBeCloseTo(4.1+p.getX(i)*.001+p.getZ(i)*.0005, 4);
      seen.add(row.id);
    }
  } finally { input.close(); source.destroy(); }
  expect([...seen].sort()).toEqual(Object.keys(expected).sort());
});

test("the original smooth path releases the field, beside streets and snow stay at their old level", async () => {
  const surfaces = await Bun.file(new URL("../public/mesh/regierungsviertel/surface-polygons.json", import.meta.url)).json();
  const local: SurfacePayload = { schema_version: surfaces.schema_version, water:[], parks:[], roads:[surfaces.roads[30]] };
  const path = createSmoothSurfaces(local,0,4.5,()=>4.5,{excludeDistrictMarkings:true}).getObjectByName("smooth paved paths") as Mesh;
  expect(path.geometry.userData.stelenfeldPavingV385).toBeGreaterThan(0);
  const snow = createSnowstorm(false).settled;
  const blanket = (snow.getObjectByName("Continuous deep snow cover across the expanded city") as Mesh).geometry;
  const oldCircle = new CircleGeometry(3600,96);
  oldCircle.deleteAttribute("normal"); oldCircle.deleteAttribute("uv");
  oldCircle.rotateX(-Math.PI/2); oldCircle.translate(-735,5.72,-355);
  const oldBlanket = cutGrosserSternGatehouseGroundSurface(oldCircle);
  expect(blanket.userData.stelenfeldPavingV385).toBe(4);
  // The entire field, measured independently from its cadastral eight-corner ring.
  expect(Math.abs(areaXZ(oldBlanket)-areaXZ(blanket)-19064.5068075)).toBeLessThan(.15);
  const mesh = new Mesh(blanket,new MeshBasicMaterial({side:DoubleSide}));
  const drifts = snow.getObjectByName("Wind-shaped deep snowdrifts") as InstancedMesh;
  expect(drifts.count).toBe(167);
  for (const [x,z] of [[521.686,577.65],[460,552],[484,605],[492,513],[421,640],[550,608]]) {
    const inside = inStelenfeldSite(x,z);
    const down = new Raycaster(new Vector3(x,15,z),new Vector3(0,-1,0));
    expect(!!down.intersectObject(mesh).length).toBe(!inside);
    if (inside) {
      expect(down.intersectObject(path)).toHaveLength(0);
      expect(down.intersectObject(drifts)).toHaveLength(0);
    }
  }
});
