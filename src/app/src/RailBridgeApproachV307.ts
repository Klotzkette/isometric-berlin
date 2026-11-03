/** Complete source-contour approach, measured pavement and explicit datum fit. */
import type{Group}from'three';
import ground from'./data/railBridgeApproachV307Ground.json';
import bodies from'./data/railBridgeApproachV307Bodies.json';
import pavement from'./data/railBridgeApproachV307Pavement.json';
import {createPackedRootStepsV309,completePackedRootV307,type RequiredPackedV307}from'./requiredPackedRootV307';
const owner=Symbol('Complete paired Swinemuender approach v307');
export function* createRailBridgeApproachStepsV309(native=false,onCreate?:(root:Group)=>void):Generator<void,Group>{
 yield;
 if(ground.schemaVersion!==1||bodies.schemaVersion!==1||pavement.schemaVersion!==1)throw Error('Missing complete source-bound approach family');
 const models=[...ground.meshes,...bodies.models,...pavement.models]as unknown as RequiredPackedV307[],selected=models.filter(q=>q.native===native);
 if(!selected.some(q=>q.key.includes('unchanged-house-contours'))||!selected.some(q=>q.key.includes('measured-pavement'))||!selected.some(q=>q.field==='bridge-approach-v307:lower')||!selected.some(q=>q.field==='bridge-approach-v307'))throw Error('Incomplete approach terrain/body/pavement pair');
 return yield* createPackedRootStepsV309(owner,'Measured Swinemuender landing and explicit legacy datum reconciliation v307',native,selected,{measuredPavementM:48.24463678135497,estimatedDatumFit:true,wholeOldHouseContours:true},onCreate);
}
export function hasCompleteRailBridgeApproachV307(root:Group,native?:boolean):boolean{return completePackedRootV307(root,owner,native);}

export function createRailBridgeApproachV307(native=false):Group{const steps=createRailBridgeApproachStepsV309(native);for(;;){const s=steps.next();if(s.done)return s.value;}}
