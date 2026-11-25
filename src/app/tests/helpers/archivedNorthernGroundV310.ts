/** Replay the ground constructors of a7625d82136b1cb8ea0fde23521a4963c67d67f0.
 * Both complete instance streams are checked against the original capture.
 * The staged working city and the native browser have independent coverage. */
import {createHash} from "node:crypto";
import {Group, MeshBasicMaterial} from "three";
import {CLASS_SHADES, createGroundSlabs, smoothGroundTopSampler, restoreGrosserSternGatehouseGroundOwnership, type VoxelPayload} from "../../src/terrainPayload";
import {createTillaDurieuxGroundTester, ISO_GROUND_SHADES, type SurfacePayload} from "../../src/IsometricCityWorld";
import {pointInUnterDenLindenEntranceRegion} from "../../src/unterDenLindenEntrancesProfile";
import {isBebelLibraryGroundCell} from "../../src/bebelplatzMemorialProfile";
import {pointInBrandenburgApproach} from "../../src/brandenburgApproachScope";
import {isSpreebogenRasterReplacementAt, SPREEBOGEN_BANK_BOUNDS, spreebogenTerrainYAt} from "../../src/spreebogenBankProfile";
import {restoreDrawnWaterBoundary} from "../../src/drawnWaterBoundary";
import {restoreAltMitteGroundSeamsV206} from "../../src/AltMitteGroundSeamsV206";
import {createTunnelPortalApproachTester,type TunnelPortalCourseInput} from "../../src/TunnelPortals";
import {createMonbijouGroundCellTesterV231} from "../../src/monbijouPreviousV231";
import {sandkrugDeckContains,isNorthernHumboldthafenReplacementCell} from "../../src/HumboldthafenSources";
import {isBundestagSpreeBridgeGroundCell} from "../../src/MinecraftVoxelWorld";
import {restoreJamesSimonGroundOwnership} from "../../src/JamesSimonGroundOwnership";
import {restoreHbfNorthRailGroundOwnership} from "../../src/HbfNorthRailGroundOwnership";
import {tintSintiRomaNativeWaterV256} from "../../src/SintiRomaNativeWaterV256";
import {cutUbahnGroundSlabsV281,cutUbahnPresentationV281} from "../../src/UbahnSurfaceAperturesV281";
import {cutUbahnPresentationV261} from "../../src/UbahnSurfaceAperturesV261";
import {cutRosenthalerPresentationV228} from "../../src/RosenthalerSurfaceAperturesV228";
import {restoreFidelityGroundSlabsV296} from "../../src/FidelityGroundOpeningsV296";
import {parkStaticInstancesSteps} from "../../src/losslessStaticStorage";
import {compactStaticGeometry} from "../../src/compactStaticGeometry";
import {freezeStaticSceneTransforms} from "../../src/staticSceneTransforms";

export async function archivedNorthernGroundV310(native:boolean,onStage?:(name:string,count:number)=>void) {
  const read = <T>(name:string):Promise<T> => Bun.file(new URL("../../public/mesh/regierungsviertel/"+name+".json",import.meta.url)).json();
  const [ground,scene] = await Promise.all([read<VoxelPayload>(native?"minecraft-voxels":"ground-context"),read<{tiergartentunnel:TunnelPortalCourseInput}>("scene")]);
  const {cell_m:cell,grid}=ground;
  const tunnel=createTunnelPortalApproachTester(scene.tiergartentunnel,cell/Math.SQRT2);
  const sourceTop=smoothGroundTopSampler(ground);
  const monbijou=native && createMonbijouGroundCellTesterV231(ground);
  const tilla=!native && createTillaDurieuxGroundTester(await read<SurfacePayload>("surface-polygons"));
  const common=(x:number,z:number)=>pointInUnterDenLindenEntranceRegion(x,z)||isBebelLibraryGroundCell(x,z)||tunnel(x,z);
  const slabs = native ? createGroundSlabs(ground,"Voxel ground runs",CLASS_SHADES,{
    parkRelief:"native",
    terrainOverride:{bounds:SPREEBOGEN_BANK_BOUNDS,topAt:(x,z)=>isSpreebogenRasterReplacementAt(x,z,0)?
      spreebogenTerrainYAt(x,z,sourceTop(x/cell-grid.min_x_idx,z/cell-grid.min_z_idx))-.24:null},
    skipAtWorld:(x,z)=>common(x,z)||isNorthernHumboldthafenReplacementCell(x,z),
    skipBridgeAtWorld:(x,z)=>Boolean(monbijou && monbijou(x,z))||isBundestagSpreeBridgeGroundCell(x,z)||sandkrugDeckContains(x,z),
  }):createGroundSlabs(ground,"Drawn ground slabs",ISO_GROUND_SHADES,{
    parkRelief:"drawn",emissive:0,skipClasses:["asphalt"],skipBridge:true,skipWater:true,
    skipAtWorld:(x,z)=>common(x,z)||pointInBrandenburgApproach(x,z,cell/Math.SQRT2)||isSpreebogenRasterReplacementAt(x,z,cell)||Boolean(tilla&&tilla(x,z)),
  });
  if(!native){
    slabs.userData.nightMaterial=slabs.material;
    slabs.material=slabs.userData.dayMaterial=new MeshBasicMaterial({color:0xffffff});
  }
  restoreJamesSimonGroundOwnership(slabs,ground);
  restoreHbfNorthRailGroundOwnership(slabs,ground,!native);
  restoreGrosserSternGatehouseGroundOwnership(slabs);
  if(native)tintSintiRomaNativeWaterV256(slabs);
  else {restoreDrawnWaterBoundary(slabs,ground);restoreAltMitteGroundSeamsV206(slabs,ground);}
  cutUbahnGroundSlabsV281(slabs,native);
  onStage?.("first-ground-yield",slabs.count);
  restoreFidelityGroundSlabsV296(slabs,{native,dining:true,waterfront:true});
  onStage?.("complete-constructor",slabs.count);
  const root=new Group();
  root.name=native?"Minecraft voxel world (LoD2 + OSM + official tree points)":"Drawn isometric city (LoD2 prisms + ink lines)";
  root.add(slabs);
  cutUbahnPresentationV261(root,native);cutUbahnPresentationV281(root,native);cutRosenthalerPresentationV228(root,native);
  onStage?.("complete-required-sites",slabs.count);
  if(native)for(const _step of parkStaticInstancesSteps(root)){}
  else root.traverse(compactStaticGeometry);
  onStage?.("instance-parking",slabs.count);
  const hash = createHash("sha256");
  for(const a of [slabs.instanceMatrix,slabs.instanceColor!])hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
  const actual=hash.digest("hex"),expected=native?"eae3f7b8ccffca9f2b19ec76375046eb32a925fade45bef3eaa6a18faf00b5c0":"5ae1873b5b3fec5236d4d1aec856d47d969a7da7f018c1dda208ed9c7bf94127";
  if(actual!==expected)throw Error("Archived "+(native?"native":"drawn")+" ground changed ("+slabs.count+", "+actual+")");
  return freezeStaticSceneTransforms(root);
}
