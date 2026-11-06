/** Audited missing ATZE envelope; existing GRIPS/Podewil stay untouched. */
import{Group}from"three";
import data from"./data/youthTheatresV322.json";
import{createPackedRootStepsV309,completePackedRootV307,type RequiredPackedV307}from"./requiredPackedRootV307";
import{youthTheatreControlStepsV322}from"./ArchenholdV322";
const OWNER=Symbol("complete ATZE V322"),MODEL_CONTROL=805605763,PRISM_CONTROL=4097332506;
const admitted=new WeakSet<Group>();
export function* createYouthTheatresV322Steps(native=false,options:{sourcePrisms?:readonly unknown[];mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group|null>{
 // The actual published inventory proves a missing owner, not a duplicate campus shell.
 if(!Array.isArray(options.sourcePrisms)||options.sourcePrisms.length!==29818||!(yield*youthTheatreControlStepsV322(options.sourcePrisms,PRISM_CONTROL))||!(yield*youthTheatreControlStepsV322(data,MODEL_CONTROL,true)))return null;
 const models=data.models.filter(q=>q.native===native&&["atze-","parkaue-","strahl-"].some(prefix=>q.key.startsWith(prefix)))as RequiredPackedV307[];if(models.length!==3)return null;
 const root=yield*createPackedRootStepsV309(OWNER,"Complete ATZE, Parkaue and StrahlOst source theatres V322",native,models,{youthTheatresV322:true,sourceEnvelopeComplete:true,facadeFittingsEstimated:true},onCreate);admitted.add(root);return root;
}
export function createYouthTheatresV322(native=false,options:{sourcePrisms?:readonly unknown[];mobileLike?:boolean}={}):Group|null{const g=createYouthTheatresV322Steps(native,options);for(;;){const n=g.next();if(n.done)return n.value;}}
export function hasCompleteYouthTheatresV322(root:Group,native?:boolean):boolean{return admitted.has(root)&&completePackedRootV307(root,OWNER,native);}
