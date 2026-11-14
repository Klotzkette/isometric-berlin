/** Read-only capture of the production Drawn ground construction, without
 * creating buildings, loading Native packets or starting a renderer. */
import { createGroundSlabs, restoreGrosserSternGatehouseGroundOwnership, type VoxelPayload } from "../src/terrainPayload";
import { createTillaDurieuxGroundTester, ISO_GROUND_SHADES, type SurfacePayload } from "../src/IsometricCityWorld";
import { restoreRoadGroundV343 } from "../src/RoadGroundV343";
import { compactStaticGeometry } from "../src/compactStaticGeometry";
import { Mesh } from "three";
import { createKulturforumPlazaV343 } from "../src/KulturforumPlazaV343";
import { createTunnelPortalApproachTester } from "../src/TunnelPortals";
import { pointInUnterDenLindenEntranceRegion } from "../src/unterDenLindenEntrancesProfile";
import { pointInBrandenburgApproach } from "../src/brandenburgApproachScope";
import { isBebelLibraryGroundCell } from "../src/bebelplatzMemorialProfile";
import { isSpreebogenRasterReplacementAt } from "../src/spreebogenBankProfile";
import { restoreJamesSimonGroundOwnership } from "../src/JamesSimonGroundOwnership";
import { restoreHbfNorthRailGroundOwnership } from "../src/HbfNorthRailGroundOwnership";
import { restoreDrawnWaterBoundary } from "../src/drawnWaterBoundary";
import { restoreAltMitteGroundSeamsV206 } from "../src/AltMitteGroundSeamsV206";
import { cutUbahnGroundSlabsV281 } from "../src/UbahnSurfaceAperturesV281";
import { restoreFidelityGroundSlabsV296 } from "../src/FidelityGroundOpeningsV296";

const base = `${import.meta.dir}/../public/mesh/regierungsviertel/`;
const ground = await Bun.file(`${base}ground-context.json`).json() as VoxelPayload;
const surfaces = await Bun.file(`${base}surface-polygons.json`).json() as SurfacePayload;
const scene = await Bun.file(`${base}scene.json`).json();
const insideTunnelApproach = createTunnelPortalApproachTester(scene.tiergartentunnel, ground.cell_m / Math.SQRT2);
const insideTillaDurieux = createTillaDurieuxGroundTester(surfaces);
const slabs = createGroundSlabs(ground, "Drawn ground capture v343", ISO_GROUND_SHADES, {
  parkRelief: "drawn", emissive: 0,
  skipClasses: ["asphalt"], skipBridge: true, skipWater: true,
  skipAtWorld: (x,z) => pointInUnterDenLindenEntranceRegion(x,z) || isBebelLibraryGroundCell(x,z) ||
    pointInBrandenburgApproach(x,z,ground.cell_m / Math.SQRT2) || isSpreebogenRasterReplacementAt(x,z,ground.cell_m) ||
    insideTunnelApproach(x,z) || insideTillaDurieux(x,z),
});
restoreJamesSimonGroundOwnership(slabs, ground);
restoreHbfNorthRailGroundOwnership(slabs, ground, true);
restoreGrosserSternGatehouseGroundOwnership(slabs);
restoreDrawnWaterBoundary(slabs, ground);
restoreAltMitteGroundSeamsV206(slabs, ground);
cutUbahnGroundSlabsV281(slabs, false);
restoreFidelityGroundSlabsV296(slabs, { dining: true, waterfront: true });
const values = slabs.instanceMatrix.array;
const records: number[][] = [];
for (let i = 0; i < slabs.count; i++) {
  const o = i * 16, width = values[o], depth = values[o+10];
  if (width <= 0 || depth !== ground.cell_m) continue;
  records.push([values[o+12]-width/2, values[o+14]-depth/2, values[o+12]+width/2,
    values[o+14]+depth/2, values[o+13]+values[o+5]/2, values[o+5]]);
}
await Bun.write(process.argv[2], JSON.stringify({ policy: "Actual retained instance matrices after all preceding production ground exclusions; existing child complements untouched", records }));
console.log(JSON.stringify({ instances: slabs.count, captured: records.length }));
if (process.argv.includes("--benchmark")) {
  const previous = new Set(slabs.children), beforeInstances=slabs.count;
  const started=performance.now();restoreRoadGroundV343(slabs,ground,createKulturforumPlazaV343(ground));const constructed=performance.now();
  let meshes=0,bytes=0,saved=0,vertices=0;
  for(const child of slabs.children)if(!previous.has(child))child.traverse(object=>{
    if(!(object instanceof Mesh))return;
    meshes++;saved+=compactStaticGeometry(object);
    vertices+=object.geometry.getAttribute("position").count;
    bytes+=(object.geometry.index?.array.byteLength??0)+Object.values(object.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0);
  });
  console.log(JSON.stringify({roadGroundV343:{constructionMs:performance.now()-started,
    ownershipMs:constructed-started,compactionMs:performance.now()-constructed,meshes,bytes,saved,vertices,
    beforeInstances,afterInstances:slabs.count,affectedCells:slabs.userData.roadGroundCellsV343}}));
}
