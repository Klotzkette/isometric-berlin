/** Read-only v345 capture after the actual v343 transaction and final path builders, without
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
restoreRoadGroundV343(slabs, ground, createKulturforumPlazaV343(ground));
const { tiergartenPathSourceGuardV345 } = await import("../src/tiergartenPathSourceGuardV345");
const sourceGuard=tiergartenPathSourceGuardV345(ground,surfaces);
const values = slabs.instanceMatrix.array;
const records: number[][] = [];
for (let i = 0; i < slabs.count; i++) {
  const o = i * 16, width = values[o], depth = values[o+10];
  if (width <= 0 || depth !== ground.cell_m) continue;
  records.push([values[o+12]-width/2, values[o+14]-depth/2, values[o+12]+width/2,
    values[o+14]+depth/2, values[o+13]+values[o+5]/2, values[o+5]]);
}
await Bun.write(process.argv[2], JSON.stringify({ policy: "Actual retained instance matrices after all preceding production ground exclusions; existing child complements untouched", records,sourceGuard }));
console.log(JSON.stringify({ instances: slabs.count, captured: records.length }));


const { createSmoothSurfaces } = await import("../src/IsometricCityWorld");
const { smoothGroundTopSampler } = await import("../src/terrainPayload");
const { createRestoredRoadBatch } = await import("../src/restoredRoadSurfaces");
const { spreebogenTerrainYAt } = await import("../src/spreebogenBankProfile");
const sample=smoothGroundTopSampler(ground);
const terrain=(x:number,z:number)=>sample(x/ground.cell_m-ground.grid.min_x_idx,z/ground.cell_m-ground.grid.min_z_idx);
const selected={...surfaces,parks:[],water:[],scrub_points:[],lane_markings:[],sunken_walls:[],roads:surfaces.roads?.filter(s=>s.kind==="sand"||s.kind==="earth")};
const g=createSmoothSurfaces(selected,ground.water_top_y_m??0,5.35,terrain,{parliamentaryDiningV296:true,waterfrontV296:true});
const result:any[]=[];
function capture(root:any){root.traverse((object:any)=>{if(!(object instanceof Mesh))return;
 const geo=object.geometry,p=geo.getAttribute("position"),ind=geo.index;
 result.push({name:object.name,positions:Buffer.from(p.array.buffer,p.array.byteOffset,p.array.byteLength).toString("base64"),indices:ind?Buffer.from(new Uint32Array(ind.array).buffer).toString("base64"):null});
});}
capture(g);
const lines=(await Bun.file(`${import.meta.dir}/../src/data/restoredRoadSurfaces.ndjson.txt`).text()).split("\n");
for(const line of lines){if(!line)continue;const batch=JSON.parse(line);if(batch.kind!=="paving")continue;
 const xz=new Float32Array(Uint8Array.from(atob(batch.xz),(c:string)=>c.charCodeAt(0)).buffer);
 let relevant=false;for(let i=0;i<xz.length;i+=2)if(xz[i]>-3000&&xz[i]<200&&xz[i+1]>-550&&xz[i+1]<1600){relevant=true;break;}
 if(relevant)capture(createRestoredRoadBatch(batch,(x,z)=>spreebogenTerrainYAt(x,z,terrain(x,z))));}
await Bun.write(process.argv[3],JSON.stringify(result));
console.log(JSON.stringify({meshes:result.length,encodedBytes:result.reduce((n,s)=>n+s.positions.length,0)}));
