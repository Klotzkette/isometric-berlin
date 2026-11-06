/** Required main-thread public office models and one exact shared-owner transfer.
 * No catalogue or decoder from this module belongs in the geometry Worker. */
import {Group,InstancedMesh,Material,Mesh,Line,Points,type Object3D} from "three";
import {
  createFederalMinistriesV321Steps, hasCompleteFederalMinistriesV321,
  federalMinistryPreviousPlanV321, federalMinistryNavigationV321,
  federalMinistryPreviousPrismV321,
  federalMinistryPreviewPlanV321,
} from "./FederalMinistriesV321";
import {
  createBerlinSenateBuildingsV321Steps, hasCompleteBerlinSenateBuildingsV321,
  berlinSenatePreviousPlanV321, berlinSenateNavigationV321,
  berlinSenatePreviousPrismV321,
  berlinSenatePreviewPlanV321,
} from "./BerlinSenateBuildingsV321";
import {
  composeExactOwnersSourcesV321Steps,createExactOwnersSourceV321Steps,stageExactOwnersV321Steps,
  type ExactOwnersHooksV321,type ExactOwnersTransactionV321,type ExactOwnersSourceV321,
} from "./ExactOwnersV321";
import {federalMinistryPressQuarterPlanV321} from "./FederalMinistryPressQuarterV321";
import {
  createUniversitiesArchitectureV322Steps,hasCompleteUniversitiesArchitectureV322,
  universitiesPreviousPrismV322,universitiesNavigationV322,uniExactPlansV322,
} from "./UniversitiesArchitectureV322";
export {universitiesPreviousPrismV322} from "./UniversitiesArchitectureV322";
import {createYouthTheatresV322Steps,hasCompleteYouthTheatresV322} from "./YouthTheatresV322";
import {requiredYouthTheatresNavigationV322} from "./youthTheatresV322Navigation";
import {createMaisonDeFranceV322Steps,hasCompleteMaisonDeFranceV322} from "./MaisonDeFranceV322";
import type {PrismBuilding} from "./IsometricCityWorld";
import type {DeutschesTheaterVoxelPayload} from "./DeutschesTheater";
// The viewer imports this namespace lazily; central preparation must not keep
// the complete office-plan graph in its synchronous startup imports either.
export {createGovernmentCentralV321,type GovernmentCentralV321} from "./GovernmentCentralV321";

export type GovernmentOfficesV321={
  root:Group;
  complete:()=>boolean;
  /** True only while the optional real university model and its transfers admit. */
  universitiesReadyV322?:()=>boolean;
  admissionV322?:()=>{government:boolean;universities:boolean};
  navigationCandidateV322?:(x:number,z:number,radius?:number)=>boolean;
  stagePreviousSteps:(family:Object3D,hooks?:ExactOwnersHooksV321)=>Generator<void,boolean>;
  stagePreviewSteps:(family:Object3D,hooks?:ExactOwnersHooksV321)=>Generator<void,boolean>;
  /** Only the complete existing PressQuarter group, independently from Core. */
  stagePressQuarterSteps:(family:Object3D,hooks?:ExactOwnersHooksV321)=>Generator<void,boolean>;
  /** Call synchronously after attaching a previously parentless Worker batch. */
  activateFamily:(family:Object3D)=>boolean;
  /** Call before a legitimate family eviction/disposal, never after detaching. */
  releaseFamily:(family:Object3D)=>void;
  solidAt:(x:number,y:number,z:number,radius?:number)=>boolean;
  groundAt:(x:number,z:number,currentY?:number)=>number|null;
  rollback:()=>void;
};
export function governmentPreviousPrismV321(prism:PrismBuilding):boolean{
  return federalMinistryPreviousPrismV321(prism)||berlinSenatePreviousPrismV321(prism);
}
export type GovernmentOfficesOptionsV321={sourcePrisms:readonly PrismBuilding[];
  voxels?:DeutschesTheaterVoxelPayload;native:boolean;mobileLike:boolean;
  includeUniversitiesV322?:boolean};
function disposeUnpublished(root:Group):void{
  const geometries=new Set<Mesh["geometry"]>(),materials=new Set<Material>();
  root.traverse(object=>{if(object instanceof Mesh||object instanceof Line||object instanceof Points){
    geometries.add(object.geometry);for(const material of[object.material,object.userData.dayMaterial,
      object.userData.nightMaterial,object.userData.schwellenraumMaterial].flat())if(material instanceof Material)materials.add(material);
    if(object instanceof InstancedMesh)object.dispose();
  }});
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();root.clear();
}
/** Sources are bound once per family before either full regional model builds. */
export function* createGovernmentOfficesV321Steps(options:GovernmentOfficesOptionsV321,onCreate?:(root:Group)=>void):Generator<void,GovernmentOfficesV321|null>{
  const {sourcePrisms,voxels,native,mobileLike}=options;
  const includeUniversities=options.includeUniversitiesV322===true;
  const root=new Group();root.name=`Government offices V321${native?" native":" drawn"}`;
  let delivered=false;
  try{
  onCreate?.(root);
  const source=yield*composeExactOwnersSourcesV321Steps([
    federalMinistryPreviousPlanV321(native,mobileLike),
    berlinSenatePreviousPlanV321(native,mobileLike),
    ...(includeUniversities?[uniExactPlansV322(native,mobileLike,false)]:[]),
  ],sourcePrisms,voxels);
  if(!source)return null;
  // The coverage preview has a different actual constructor/host from full
  // Core bodies. Never combine the two into one partially present family.
  const previewSource=native?null:yield*composeExactOwnersSourcesV321Steps([
    federalMinistryPreviewPlanV321(),berlinSenatePreviewPlanV321(),
    ...(includeUniversities?[uniExactPlansV322(false,mobileLike,true)]:[]),
  ],sourcePrisms);
  if(!native&&!previewSource)return null;
  // Its old street fittings share a Core owner but have a distinct actual
  // host. Combining them with Core would falsely reject ordinary Worker batches.
  const pressEntry=federalMinistryPressQuarterPlanV321(native);
  const pressSource=yield*createExactOwnersSourceV321Steps(pressEntry.plan,sourcePrisms,pressEntry.control,voxels);
  if(!pressSource)return null;
  const pressOwnerIds=pressEntry.plan.owners.map(owner=>owner.id);
  const pressName=native?"Press quarter v272 independent native architecture":"Press quarter v272 complete measured architecture";
  const regionalOptions={sourcePrisms,voxels,mobileLike};
  const federal=yield*createFederalMinistriesV321Steps(native,regionalOptions,group=>root.add(group));
  if(!federal)return null;if(federal.parent!==root)root.add(federal);
  const senate=yield*createBerlinSenateBuildingsV321Steps(native,regionalOptions,group=>root.add(group));
  if(!senate)return null;if(senate.parent!==root)root.add(senate);
  const universities=includeUniversities?yield*createUniversitiesArchitectureV322Steps(native,regionalOptions,group=>root.add(group)):null;
  if(includeUniversities&&!universities)return null;
  if(universities&&universities.parent!==root)root.add(universities);
  const theatres=includeUniversities?yield*createYouthTheatresV322Steps(native,regionalOptions,group=>root.add(group)):null;
  if(includeUniversities&&!theatres)return null;
  if(theatres&&theatres.parent!==root)root.add(theatres);
  const maison=includeUniversities?yield*createMaisonDeFranceV322Steps(native,regionalOptions,group=>root.add(group)):null;
  if(includeUniversities&&!maison)return null;
  if(maison&&maison.parent!==root)root.add(maison);
  const expectedChildren=[federal,senate,...(universities?[universities]:[]),...(theatres?[theatres]:[]),...(maison?[maison]:[])];
  // A negative broad phase borrows only actual completed render bounds. It
  // never grants admission; every positive query still runs the full receipt.
  const navigationBoundsV322:number[][]=[];
  if(includeUniversities){root.updateMatrixWorld(true);root.traverse(object=>{if(!(object instanceof Mesh))return;
    let bounds=object instanceof InstancedMesh?object.boundingBox:object.geometry.boundingBox;
    if(!bounds){if(object instanceof InstancedMesh){object.computeBoundingBox();bounds=object.boundingBox;}else{object.geometry.computeBoundingBox();bounds=object.geometry.boundingBox;}}
    if(bounds&&!bounds.isEmpty()){const box=bounds.clone().applyMatrix4(object.matrixWorld);
      // Conservative only: cover Float32 display rounding at a source edge.
      // This padding never participates in positive source/owner admission.
      box.expandByScalar(Math.max(.01,Math.max(Math.abs(box.min.x),Math.abs(box.min.z),Math.abs(box.max.x),Math.abs(box.max.z))*2**-20));
      navigationBoundsV322.push([box.min.x,box.min.z,box.max.x,box.max.z]);}
  });}
  root.updateMatrix();root.matrixAutoUpdate=false;
  const pose=[...root.matrix.elements,...root.position.toArray(),...root.quaternion.toArray(),...root.scale.toArray()];
  const autoUpdate=root.matrixAutoUpdate,worldAutoUpdate=root.matrixWorldAutoUpdate;
  const rootPoseReady=()=>root.matrixAutoUpdate===autoUpdate&&root.matrixWorldAutoUpdate===worldAutoUpdate&&
    [...root.matrix.elements,...root.position.toArray(),...root.quaternion.toArray(),...root.scale.toArray()].every((v,i)=>Object.is(v,pose[i]));
  type FamilyKind="core"|"preview"|"press";
  type Link={object:Object3D;values:number[]};
  type Family={kind:FamilyKind;tx:ExactOwnersTransactionV321;phase:"pending"|"active"|"released";path:Link[]|null};
  const families=new Map<Object3D,Family>();
  // Unrelated batches retire no owner and need no recurring family/array scan.
  const emptyFamilies=new WeakMap<Object3D,{kind:FamilyKind;pending:boolean}>();
  const staging=new Set<Object3D>();
  let expectedWorld:Object3D|null=null;
  let closed=false;
  const contentsReady=()=>rootPoseReady()&&root.visible&&root.children.length===expectedChildren.length&&expectedChildren.every((child,i)=>root.children[i]===child&&child.parent===root&&child.visible)&&
    federal.visible&&senate.visible&&hasCompleteFederalMinistriesV321(federal,native)&&
    hasCompleteBerlinSenateBuildingsV321(senate,native)&&
    (!universities||hasCompleteUniversitiesArchitectureV322(universities,native))&&
    (!theatres||hasCompleteYouthTheatresV322(theatres,native))&&
    (!maison||hasCompleteMaisonDeFranceV322(maison,native));
  const modelsReady=()=>!closed&&expectedWorld!==null&&root.parent===expectedWorld&&contentsReady();
  const values=(object:Object3D)=>[...object.matrix.elements,...object.position.toArray(),...object.quaternion.toArray(),
    ...object.scale.toArray(),+object.matrixAutoUpdate,+object.matrixWorldAutoUpdate];
  const worldPath=(family:Object3D):Link[]|null=>{
    const path:Link[]=[];
    for(let object:Object3D|null=family;object;object=object.parent){
      if(object===root)return null;
      path.push({object,values:values(object)});if(object===expectedWorld)return path;
    }return null;
  };
  const pathReady=(family:Object3D,path:Link[]|null)=>{
    const now=worldPath(family);return !!path&&!!now&&now.length===path.length&&now.every((p,i)=>p.object===path[i].object&&
      p.values.length===path[i].values.length&&p.values.every((v,j)=>Object.is(v,path[i].values[j])));
  };
  const federalNav=federalMinistryNavigationV321(federal,native);
  const senateNav=berlinSenateNavigationV321(senate,native);
  const universityNav=universities?universitiesNavigationV322(universities,native):null;
  const theatreNav=theatres?requiredYouthTheatresNavigationV322(theatres,native):null;
  const rollback=()=>{if(closed)return;closed=true;root.visible=false;
    const current=[...families.values()].reverse();families.clear();
    for(const family of current){family.phase="released";family.tx.rollback();}};
  const complete=()=>{if(closed)return false;let ready=modelsReady();
    for(const [object,family]of families){
      if(family.phase==="active"&&!pathReady(object,family.path))ready=false;
      // Pending batches may still have parent=null while the Worker scan or
      // caller's publish task yields. They have not acquired a world path yet.
      if(!family.tx.complete())ready=false;
    }
    if(!ready&&expectedWorld!==null)rollback();return ready;};
  if(!contentsReady())return null;
  function* stage(family:Object3D,kind:FamilyKind,receipt:ExactOwnersSourceV321|null,hooks:ExactOwnersHooksV321):Generator<void,boolean>{
    if(closed||!receipt||family===root||staging.has(family))return false;
    if(expectedWorld===null){if(!root.parent)return false;expectedWorld=root.parent;}
    if(!complete())return false;
    const existing=families.get(family),empty=emptyFamilies.get(family);
    if(existing)return existing.kind===kind&&existing.tx.complete();
    if(empty)return empty.kind===kind;
    const path=worldPath(family);
    if(!path&&(family.parent!==null||kind!=="core"))return false;
    let state:Family|undefined,tx:ExactOwnersTransactionV321|null=null,delivered=false;
    const familyReady=()=>modelsReady()&&(kind!=="press"||family.name===pressName)&&(!state||state.phase!=="released")&&
      (state?.phase==="active"?pathReady(family,state.path):path?pathReady(family,path):family.parent===null||worldPath(family)!==null);
    staging.add(family);
    try{
      tx=yield*stageExactOwnersV321Steps(family,receipt,familyReady,hooks);
      // Stage already proves the full original cooperatively; commit repeats
      // the strict source/word gate after retirement hooks before any swap.
      if(!tx||kind==="press"&&(tx.activeOwners.length!==pressOwnerIds.length||pressOwnerIds.some(owner=>!tx!.activeOwners.includes(owner)))||
        !tx.commit(familyReady)||!tx.complete()){tx?.rollback();rollback();return false;}
      if(tx.activeOwners.length){
        state={kind,tx,phase:path?"active":"pending",path};families.set(family,state);
        yield*tx.parkRetiredSourcesSteps();
        const ready=familyReady(),sourceReady=tx.complete();
        if(!ready||!sourceReady){rollback();return false;}
      }
      else{tx.rollback();emptyFamilies.set(family,{kind,pending:!path});}
      delivered=true;return true;
    }finally{staging.delete(family);if(!delivered){
      if(state){if(families.get(family)===state)families.delete(family);state.phase="released";}
      tx?.rollback();
    }}
  }
  const result:GovernmentOfficesV321={root,complete,
    universitiesReadyV322:()=>!!universities&&complete(),
    admissionV322:()=>{const government=complete();return {government,universities:government&&!!universities};},
    navigationCandidateV322:(x,z,radius=0)=>!includeUniversities||navigationBoundsV322.some(b=>x+radius>=b[0]&&x-radius<=b[2]&&z+radius>=b[1]&&z-radius<=b[3]),
    *stagePreviousSteps(family,hooks={}){return yield*stage(family,"core",source,hooks);},
    *stagePreviewSteps(family,hooks={}){return yield*stage(family,"preview",previewSource,hooks);},
    *stagePressQuarterSteps(family,hooks={}){
      if(family.name!==pressName)return false;
      return yield*stage(family,"press",pressSource,hooks);
    },
    activateFamily(family){
      if(!complete())return false;
      const state=families.get(family),empty=emptyFamilies.get(family),path=worldPath(family);
      if(!state&&!empty)return false;
      if(!path){rollback();return false;}
      if(state){if(state.phase==="released"||!state.tx.complete()){rollback();return false;}
        if(state.phase==="active")return pathReady(family,state.path);
        state.path=path;state.phase="active";
      }else if(empty)empty.pending=false;
      return true;
    },
    releaseFamily(family){
      const state=families.get(family);emptyFamilies.delete(family);
      if(!state)return;
      if(state.phase==="active"&&!pathReady(family,state.path)){rollback();return;}
      families.delete(family);state.phase="released";state.tx.rollback();
    },
    solidAt(x,y,z,radius=0){return modelsReady()&&
      (federalNav?.solidAt(x,y,z,radius)===true||senateNav?.solidAt(x,y,z,radius)===true||universityNav?.solidAt(x,y,z,radius)===true||theatreNav?.solidAt(x,y,z,radius)===true);},
    groundAt(x,z,currentY){if(!modelsReady())return null;
      const a=federalNav?.groundAt(x,z,currentY)??null,b=senateNav?.groundAt(x,z,currentY)??null;
      const floor=a===null?b:b===null?a:Math.max(a,b),c=universityNav?.groundAt(x,z,currentY)??null;
      const combined=c===null?floor:floor===null?c:Math.max(floor,c),d=theatreNav?.groundAt(x,z,currentY)??null;
      return d===null?combined:combined===null?d:Math.max(combined,d);},
    rollback,
  };
  delivered=true;return result;
  }finally{if(!delivered)disposeUnpublished(root);}
}

/** Small compatibility drainer; live callers use the identical cooperative API. */
export function createGovernmentOfficesV321(options:GovernmentOfficesOptionsV321):GovernmentOfficesV321|null{
  const steps=createGovernmentOfficesV321Steps(options);for(;;){const step=steps.next();if(step.done)return step.value;}
}
