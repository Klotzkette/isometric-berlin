/** Capture the actual released v374 hosts and three.js face indices in the small survey
 * window. Run with bun from the repository and pass the output JSON pathname. */
import { Mesh, type Object3D } from "three";
import {
  createIsometricCityCoreStepsV309, createSmoothSurfaces, ISO_GROUND_SHADES,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import { createDistrictStreets, districtStreetTerrainSampler } from "../src/DistrictStreets";
import { createRestoredRoadBatch } from "../src/restoredRoadSurfaces";
import { spreebogenTerrainYAt } from "../src/spreebogenBankProfile";
import { restoreRoadGroundV343 } from "../src/RoadGroundV343";
import { createKulturforumPlazaV343 } from "../src/KulturforumPlazaV343";
import { restoreTiergartenPathsV345 } from "../src/TiergartenPathsV345";
import { attachMittePlazaEdgesV367 } from "../src/MittePlazaEdgesV367";
import { surfaceFamilyPayload, splitParkSurfaceFamily } from "../src/progressiveWorld";
import type { VoxelPayload } from "../src/terrainPayload";

const base = import.meta.dir + "/../public/mesh/regierungsviertel/";
const ground = await Bun.file(base + "ground-context.json").json() as VoxelPayload;
const surfaces = await Bun.file(base + "surface-polygons.json").json() as SurfacePayload;
const scene = await Bun.file(base + "scene.json").json();
const prisms = await Bun.file(base + "lod2-prisms.json").json();

const xmin = 120, zmin = 107, xmax = 390, zmax = 304;
const rows: number[][] = [];
const tris: [string, string, number, number[], number[]][] = [];
const terrain = districtStreetTerrainSampler(ground);

function capture(root: Object3D, id: string): void {
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof Mesh) || "isInstancedMesh" in object) return;
    const geometry = object.geometry, position = geometry.getAttribute("position");
    if (!position) return;
    const index = geometry.index, matrix = object.matrixWorld.elements;
    const outside = new Uint8Array(position.count);
    for (let j = 0; j < position.count; j++) {
      const x = position.getX(j) + matrix[12], z = position.getZ(j) + matrix[14];
      outside[j] = (x < xmin ? 1 : x > xmax ? 2 : 0) | (z < zmin ? 4 : z > zmax ? 8 : 0);
    }
    const before = tris.length;
    for (let j = 0; j < (index?.count ?? position.count); j += 3) {
      const ids = [index?.getX(j) ?? j, index?.getX(j+1) ?? j+1, index?.getX(j+2) ?? j+2];
      if (outside[ids[0]] & outside[ids[1]] & outside[ids[2]]) continue;
      const xyz = ids.flatMap(v => [
        position.getX(v) + matrix[12], position.getY(v) + matrix[13], position.getZ(v) + matrix[14],
      ]);
      const determinant = (xyz[3]-xyz[0]) * (xyz[8]-xyz[2]) - (xyz[6]-xyz[0]) * (xyz[5]-xyz[2]);
      if (Math.abs(determinant) < .00001) continue;
      // The stored X/Z fragment words refer directly to this local buffer.
      if (matrix[12] || matrix[14] || matrix[0] !== 1 || matrix[5] !== 1 || matrix[10] !== 1 ||
          matrix[1] || matrix[2] || matrix[4] || matrix[6] || matrix[8] || matrix[9]) {
        throw new Error("Local survey target now has a nontrivial transform: " + object.name);
      }
      tris.push([id,object.name,j/3,ids,xyz]);
    }
    if (tris.length > before) console.log(id, object.name, tris.length - before);
  });
}

let received = false;
const steps = createIsometricCityCoreStepsV309(prisms, ground, scene.tiergartentunnel, surfaces, {
  buildings: [], smoothSurfaces: null, retainRasterAsphalt: false, invalidenGroundV371: true,
  restoreRoadGroundV343: function* (slabs, sourceGround) {
    restoreRoadGroundV343(slabs, sourceGround, createKulturforumPlazaV343(sourceGround));
    restoreTiergartenPathsV345(slabs, sourceGround, surfaces);
    yield* attachMittePlazaEdgesV367(slabs, sourceGround, ISO_GROUND_SHADES);
    const m = slabs.instanceMatrix.array;
    for (let instance = 0; instance < slabs.count; instance++) {
      const j = instance * 16, x = m[j+12] - m[j]/2, z = m[j+14] - m[j+10]/2;
      if (x > xmax || x + m[j] < xmin || z > zmax || z + m[j+10] < zmin) continue;
      rows.push([x,z,x+m[j],z+m[j+10],m[j+13]+m[j+5]/2,m[j+5]]);
    }
    capture(slabs,"rasterComplement");
    received = true;
    yield;
  },
});
while (!received && !steps.next().done) { /* Stop before unrelated building geometry. */ }
steps.return(undefined);
if (!received) throw new Error("The canonical Drawn ground callback did not run");
capture(createDistrictStreets(ground,new Set(),true), "district");

const options = {invalidenGroundV371:true,parliamentaryDiningV296:true,waterfrontV296:true};
for (const [i, payload] of splitParkSurfaceFamily(surfaces).entries()) {
  capture(createSmoothSurfaces(payload,0,5.35,terrain,options), "parks-" + (i+1));
}
for (const kind of ["sand","earth","wood","metal"] as const) {
  capture(createSmoothSurfaces(surfaceFamilyPayload(surfaces,kind),0,5.35,terrain,options),kind);
}
const stream = await Bun.file(import.meta.dir + "/../src/data/restoredRoadSurfaces.ndjson.txt").text();
for (const line of stream.split("\n")) {
  if (!line) continue;
  const batch = JSON.parse(line);
  if (!batch.xz) continue;
  const points = new Float32Array(Uint8Array.from(Buffer.from(batch.xz,"base64")).buffer);
  let relevant = false;
  for (let i = 0; i < points.length; i += 2) {
    if (points[i] >= xmin-64 && points[i] <= xmax+64 && points[i+1] >= zmin-64 && points[i+1] <= zmax+64) {
      relevant = true;
      break;
    }
  }
  if (relevant) {
    capture(createRestoredRoadBatch(batch,(x,z) => spreebogenTerrainYAt(x,z,terrain(x,z)),true),
      "restored-" + batch.id);
  }
}
await Bun.write(process.argv[2],JSON.stringify({rows,tris}));
