/** Evaluate the actual viewer's constructor arguments, not a parallel flags list. */
import ts from "typescript";
import {readFileSync} from "node:fs";
import {Group} from "three";
import {createCoreSpreeBridgesV242} from "../../src/CoreSpreeBridgesV242";
import type {PrismPayload} from "../../src/IsometricCityWorld";
const viewer=readFileSync(new URL("../../src/ThreeViewer.tsx",import.meta.url),"utf8");
const ast=ts.createSourceFile("ThreeViewer.tsx",viewer,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function call(name:string){const calls:ts.CallExpression[]=[];function walk(node:ts.Node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text===name)calls.push(node);ts.forEachChild(node,walk);}walk(ast);if(calls.length!==1)throw Error(`Exactly one actual viewer call required: ${name}`);return calls[0];}
export function runtimeConstructorOptionsV310(native:boolean,mobileLike:boolean,prisms:PrismPayload){
 const expression=call(native?"buildMinecraftVoxelWorldSteps":"createIsometricCityStepsV309").arguments[4];if(!expression||!ts.isObjectLiteralExpression(expression))throw Error("Actual complete viewer constructor options missing");
 const signatures=new Group(),bridges=new Group();bridges.name="drawn bridge structures";signatures.add(bridges);
 const bindings={runtime:{coarsePointer:mobileLike,signatures},prisms,initialBuildings:[],fidelityV288:{moabitMitte:true,westKiez:true,parliamentaryDining:true,waterfront:true,historicDom:true,potsdamerCorridor:true,chancelleryCanopy:true},hbfCirculationV291:true,parliamentInteriorsV295:true,stationPhotoAdmitted:true,surfaces:{},progressiveInput:{},createCoreSpreeBridgesV242};
 const compiled=ts.transpileModule(`const options = ${expression.getText(ast)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(bindings),`${compiled};return options;`)(...Object.values(bindings)) as Record<string,unknown>;
}
export function runtimeConstructorOptionsSourceV310(native:boolean){return call(native?"buildMinecraftVoxelWorldSteps":"createIsometricCityStepsV309").arguments[4].getText(ast);}

import {actualDrawn,json} from "./northCoreActualV309";
import type {NorthCoreTerrainRecipesV309} from "../../src/NorthCoreTerrainV309";
import type {TunnelPortalCourseInput} from "../../src/TunnelPortals";
/** Same actual initial source options/course, with unrelated context builders
 * omitted; their complete original owners are supplied by each bundle fixture. */
export async function actualDrawnRuntimeV310(source:NorthCoreTerrainRecipesV309,mobileLike=false){
 const prisms=await json<PrismPayload>("lod2-prisms.json"),manifest=await json<{tiergartentunnel:TunnelPortalCourseInput}>("scene.json"),options=runtimeConstructorOptionsV310(false,mobileLike,prisms);
 return actualDrawn(source,{tunnel:manifest.tiergartentunnel,options:{...options,buildings:[],includeContext:false,bridgeStructures:false,moabitMitteV300:false,westKiezV302:false}});
}

import {InstancedMesh,Mesh,Material,BufferGeometry} from "three";
import {buildMinecraftVoxelWorldSteps,buildColumnToneLookup,type VoxelPayload} from "../../src/MinecraftVoxelWorld";
import {preloadAltMitteNativeV169Source} from "../../src/AltMitteNativeCoreV169";
import {addRequiredSiteEnvelopesV209Steps} from "../../src/RequiredSiteEnvelopesV209";
import {parkStaticInstancesSteps} from "../../src/losslessStaticStorage";
import {freezeStaticSceneTransforms} from "../../src/staticSceneTransforms";
import {stage} from "./northCoreActualV309";
/** Finish every actual native constructor/client stage before retaining its
 * exact ground source. Unrelated full-city owners use separate fixture roots. */
export async function actualNativeRuntimeV310(onStage?:(name:string,count:number)=>void){
 await preloadAltMitteNativeV169Source();
 const payload=await json<VoxelPayload>("minecraft-voxels.json"),prisms=await json<PrismPayload>("lod2-prisms.json"),manifest=await json<{tiergartentunnel:TunnelPortalCourseInput}>("scene.json"),full=new Group();
 const ground=()=>{const all:InstancedMesh[]=[];full.traverse(o=>{if(o instanceof InstancedMesh&&o.name==="Voxel ground runs")all.push(o);});if(all.length!==1)throw Error("One exact final native ground owner required");return all[0];};
 let first=false;
 await stage(buildMinecraftVoxelWorldSteps(full,payload,buildColumnToneLookup(prisms),manifest.tiergartentunnel,runtimeConstructorOptionsV310(true,false,prisms)),()=>{if(!first&&full.getObjectByName("Voxel ground runs")){first=true;onStage?.("first-ground-yield",ground().count);}});
 onStage?.("complete-constructor",ground().count);
 await stage(addRequiredSiteEnvelopesV209Steps(full,true));full.userData.prepareNeukoellnLegacyV305?.();
 onStage?.("complete-required-sites",ground().count);await stage(parkStaticInstancesSteps(full));onStage?.("instance-parking",ground().count);
 const kept=ground(),geometry=kept.geometry,materials=new Set<Material>();for(const m of[kept.material,kept.userData.dayMaterial,kept.userData.nightMaterial].flat())if(m instanceof Material)materials.add(m);
 kept.removeFromParent();const release=new Set<BufferGeometry|Material|InstancedMesh>();full.traverse(o=>{if(o instanceof Mesh){if(o.geometry!==geometry)release.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m instanceof Material&&!materials.has(m))release.add(m);if(o instanceof InstancedMesh)release.add(o);}});for(const resource of release)resource.dispose();
 const result=new Group();result.name=full.name;result.add(kept);full.clear();freezeStaticSceneTransforms(result);return result;
}
