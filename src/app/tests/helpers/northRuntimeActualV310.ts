/** Evaluate the actual viewer's constructor arguments, not a parallel flags list. */
import ts from "typescript";
import {readFileSync} from "node:fs";
import {Group} from "three";
import {potsdamerPavilionTerrainAdmitted} from "../../src/PotsdamerPavilionRoutes";
import {createCoreSpreeBridgesV242} from "../../src/CoreSpreeBridgesV242";
import {ISO_GROUND_SHADES,type PrismPayload,type SurfacePayload} from "../../src/IsometricCityWorld";
import {gateGroundInkV374} from "../../src/GateForecourtsV374";
import type {RailPayload} from "../../src/UndergroundNetwork";
import {hasDrawnHumboldthafenV369,restoreHumboldthafenWaterV369} from "../../src/HumboldthafenRailV369";
import {createStateRepresentationFittingsV321} from "../../src/StateRepresentationsV321";
import {admitsSimsonGroundV375} from "../../src/simsonGroundGuardV375";
import {cutSimsonWoodGroundV375} from "../../src/SimsonWoodGroundV375";
import {applySimsonCutsV375} from "../../src/simsonSurfaceCutsV375";
import {cutInvalidenGroundRunsV371,trimInvalidenSurfaceV371} from "../../src/invalidenGroundOwnershipV371";
import {smoothGroundTopSampler} from "../../src/terrainPayload";
const viewer=readFileSync(new URL("../../src/ThreeViewer.tsx",import.meta.url),"utf8");
const ast=ts.createSourceFile("ThreeViewer.tsx",viewer,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function call(name:string){const calls:ts.CallExpression[]=[];function walk(node:ts.Node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text===name)calls.push(node);ts.forEachChild(node,walk);}walk(ast);if(calls.length!==1)throw Error(`Exactly one actual viewer call required: ${name}`);return calls[0];}
export function runtimeConstructorOptionsV310(native:boolean,mobileLike:boolean,prisms:PrismPayload,payload?:VoxelPayload,drawnSources:Record<string,unknown>={}){
 const expression=call(native?"buildMinecraftVoxelWorldSteps":"createIsometricCityStepsV309").arguments[4];if(!expression||!ts.isObjectLiteralExpression(expression))throw Error("Actual complete viewer constructor options missing");
 const signatures=new Group(),bridges=new Group();bridges.name="drawn bridge structures";signatures.add(bridges);
 const bindings={ground:native?null:payload,rail:null,invalidenGround:null,invalidenPark:null,mittePlazaEdgesV367:null,
   gateGroundInkV374,hasDrawnHumboldthafenV369,restoreHumboldthafenWaterV369,createStateRepresentationFittingsV321,ISO_GROUND_SHADES,
   smoothGroundTopSampler,admitsSimsonGroundV375,cutSimsonWoodGroundV375,applySimsonCutsV375,cutInvalidenGroundRunsV371,trimInvalidenSurfaceV371,Mesh,InstancedMesh,
   runtime:{coarsePointer:mobileLike,signatures},prisms,payload,potsdamerPavilionTerrainAdmitted,nordbahnhof:null,potsdamerNorthPavilion:false,initialBuildings:[],fidelityV288:{moabitMitte:true,westKiez:true,parliamentaryDining:true,waterfront:true,historicDom:true,potsdamerCorridor:true,chancelleryCanopy:true},hbfCirculationV291:true,parliamentInteriorsV295:true,stationPhotoAdmitted:true,surfaces:{},progressiveInput:{},createCoreSpreeBridgesV242,...drawnSources};
 const compiled=ts.transpileModule(`const options = ${expression.getText(ast)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(bindings),`${compiled};return options;`)(...Object.values(bindings)) as Record<string,unknown>;
}
export function runtimeConstructorOptionsSourceV310(native:boolean){return call(native?"buildMinecraftVoxelWorldSteps":"createIsometricCityStepsV309").arguments[4].getText(ast);}

import {actualDrawn} from "./northCoreActualV309";
import {archivedNorthernGroundV310} from "./archivedNorthernGroundV310";
import type {NorthCoreTerrainRecipesV309} from "../../src/NorthCoreTerrainV309";
import {InstancedMesh,Mesh} from "three";
import type {VoxelPayload} from "../../src/terrainPayload";

/** The historical integration suites compare the archived main and the
 * independent worker transfer against the receipts they originally signed. */
export async function actualDrawnRuntimeV310(source:NorthCoreTerrainRecipesV309,_mobileLike=false){
 const main=await archivedNorthernGroundV310(false);
 return actualDrawn(source,undefined,main);
}
export function actualNativeRuntimeV310(onStage?:(name:string,count:number)=>void){
 return archivedNorthernGroundV310(true,onStage);
}
