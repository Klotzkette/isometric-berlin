/** Atomic union of all measured north-park / station / Europasportpark contacts. */
import type {Group} from 'three';
import source from './data/railTerrainContactV307.json';
import core from './data/coreTerrainContactV307.json';
import approachSource from './data/railTerrainContactApproachV309.json';
import {completePackedRootV307,createPackedRootStepsV309,type RequiredPackedV307} from './requiredPackedRootV307';
const owner=Symbol('Complete measured terrain contact v307');
export function hasCompleteRailTerrainContactV307(root:Group,native?:boolean):boolean{return completePackedRootV307(root,owner,native);}
/** Full contact meshes exist in every mode before any old source triangle yields. */
export function* createRailTerrainContactStepsV309(native=false,_options:{mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group>{
 yield;
 if(source.schemaVersion!==1||source.fields.join('|')!=='humboldthain|friedrichshain|gesundbrunnen|europasportpark')throw Error('Incomplete measured v307 terrain fields');
 if(core.schemaVersion!==1||core.field!=='humboldthain')throw Error('Missing actual core Humboldthain contact');
 const meshes=([...source.meshes,...core.meshes] as RequiredPackedV307[]).filter(m=>m.native===native);
 if(new Set(meshes.map(m=>m.field)).size!==4)throw Error('A complete measured v307 field is missing');
 return yield* createPackedRootStepsV309(owner,'Complete measured park and railway terrain v307',native,meshes,{railTerrainContactV307:true,sourceReceipt:'rail-terrain-contact-v307-evidence.json.gz',sourceOutsidePaintPreserved:true},onCreate);
}
export function createRailTerrainContactV307(native=false,options:{mobileLike?:boolean}={}):Group{
 const steps=createRailTerrainContactStepsV309(native,options);
 for(;;){const step=steps.next();if(step.done)return step.value;}
}

/** Explicit derivative: same four measured families, jointly clipped around the required bridge approach. */
const approachOwner=Symbol('Complete measured contact with explicit bridge approach derivative v309');
export function hasCompleteRailTerrainContactApproachV309(root:Group,native?:boolean):boolean{return completePackedRootV307(root,approachOwner,native);}
export function* createRailTerrainContactApproachStepsV309(native=false,_options:{mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group>{
 yield;
 if(approachSource.schemaVersion!==1||approachSource.fields.join('|')!=='humboldthain|friedrichshain|gesundbrunnen|europasportpark'||core.schemaVersion!==1||core.field!=='humboldthain')throw Error('Incomplete explicit v309 terrain derivative');
 const meshes=([...approachSource.meshes,...core.meshes] as RequiredPackedV307[]).filter(m=>m.native===native);
 if(new Set(meshes.map(m=>m.field)).size!==4)throw Error('A measured derivative field is missing');
 return yield* createPackedRootStepsV309(approachOwner,'Complete measured contacts with paired bridge approach v309',native,meshes,{sourceReceipt:'rail-terrain-contact-approach-v309-evidence.json.gz',sourceOutsidePaintPreserved:true},onCreate);
}
export function createRailTerrainContactApproachV309(native=false,options:{mobileLike?:boolean}={}):Group{
 const steps=createRailTerrainContactApproachStepsV309(native,options);
 for(;;){const step=steps.next();if(step.done)return step.value;}
}
