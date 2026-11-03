/** Source-bound open rail stations and embedded SSE / Velodrom bodies. */
import type {Group} from 'three';
import source from './data/railSseArchitectureV307.json';
import {completePackedRootV307,createPackedRootStepsV309,type RequiredPackedV307} from './requiredPackedRootV307';
const owner=Symbol('Complete rail and Europasportpark architecture v307');
export function hasCompleteRailSseArchitectureV307(root:Group,native?:boolean):boolean{return completePackedRootV307(root,owner,native);}
export function* createRailSseArchitectureStepsV309(native=false,_options:{mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group>{
 yield;
 if(source.schemaVersion!==1||!source.models.length)throw Error('Missing complete v307 rail/sport architecture');
 const models=(source.models as RequiredPackedV307[]).filter(m=>m.native===native);
 const expected=native?source.catalog.minecraft:source.catalog.drawn;
 if(!expected.length||models.length!==expected.length||models.some((m,i)=>m.key!==expected[i]))throw Error('A complete v307 spatial architecture catalog is missing');
 return yield* createPackedRootStepsV309(owner,'Wedding, Gesundbrunnen, Landsberger Allee and Europasportpark v307',native,models,{railSseArchitectureV307:true,sourceReceipt:'rail-sse-v307-source.json.gz',sourceRoofsRetained:true,openCanopyEnvelopes:true,estimatedArchitecturalSections:true},onCreate);
}
export function createRailSseArchitectureV307(native=false,options:{mobileLike?:boolean}={}):Group{
 const steps=createRailSseArchitectureStepsV309(native,options);
 for(;;){const step=steps.next();if(step.done)return step.value;}
}
