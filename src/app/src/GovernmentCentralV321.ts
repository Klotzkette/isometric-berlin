/** One runtime owns the exact five obsolete scene-global education bands.
 * The active model gate is injected; no Gov bundle depends on this manager. */
import type {Object3D} from "three";
import {federalMinistryCentralPlanV321} from "./federalMinistryPreviousV321";
import {createExactOwnersSourceV321,stageExactOwnersV321Steps,
  type ExactOwnersSourceV321,type ExactOwnersTransactionV321,type ExactOwnersHooksV321} from "./ExactOwnersV321";
import type {PrismBuilding} from "./IsometricCityWorld";

const owners=new WeakMap<Object3D,symbol>();
const pose=(object:Object3D)=>[...object.matrix.elements,...object.position.toArray(),...object.quaternion.toArray(),
  ...object.scale.toArray(),+object.matrixAutoUpdate,+object.matrixWorldAutoUpdate];
function zeroFrame(object:Object3D):boolean{
  return object.position.x===0&&object.position.y===0&&object.position.z===0&&
    object.quaternion.x===0&&object.quaternion.y===0&&object.quaternion.z===0&&object.quaternion.w===1&&
    object.scale.x===1&&object.scale.y===1&&object.scale.z===1&&
    object.matrix.elements.every((v,i)=>v===(i%5===0?1:0));
}
export type GovernmentCentralV321={
  /** Exact literal plan + actual original source rows; no coordinate substitute. */
  prepare:(sourcePrisms:readonly PrismBuilding[])=>boolean;
  stageSteps:(centralRoot:Object3D,hooks?:ExactOwnersHooksV321)=>Generator<void,boolean>;
  /** Cheap live gate; a closed gate synchronously restores the original bands. */
  sync:()=>boolean;
  /** Reusable normal release, before the central host is detached/disposed. */
  release:(centralRoot?:Object3D)=>void;
  dispose:()=>void;
};

export function createGovernmentCentralV321(options:{scene:Object3D;activeWorld:()=>Object3D|null|undefined;ready:()=>boolean}):GovernmentCentralV321{
  const token=Symbol("Private shared central government fitting owner v321");
  let source:ExactOwnersSourceV321|null=null,expectedOwners:readonly string[]=[];
  let live:{root:Object3D;pose:number[];tx:ExactOwnersTransactionV321}|null=null;
  let pending:{root:Object3D;cancelled:boolean}|null=null,disposed=false;
  const admitted=()=>{try{return !disposed&&options.ready()===true;}catch{return false;}};
  const frameReady=(root:Object3D,originalPose:readonly number[])=>{
    let world:Object3D|null|undefined;try{world=options.activeWorld();}catch{return false;}
    if(!world||world===root||world.parent!==options.scene||root.parent!==options.scene||!zeroFrame(world)||!zeroFrame(root))return false;
    const current=pose(root);return current.length===originalPose.length&&current.every((v,i)=>Object.is(v,originalPose[i]));
  };
  const release=(root?:Object3D)=>{
    if(pending&&(!root||pending.root===root)){
      pending.cancelled=true;
      if(owners.get(pending.root)===token)owners.delete(pending.root);
    }
    if(live&&(!root||live.root===root)){
      const current=live;live=null;
      if(owners.get(current.root)===token)owners.delete(current.root);
      current.tx.rollback();
    }
  };
  const sync=()=>{
    if(!live)return false;
    const current=live;
    // Do not short-circuit the private transaction's own invalidation/rollback.
    const modelReady=admitted()&&frameReady(current.root,current.pose)&&owners.get(current.root)===token;
    const sourceReady=current.tx.complete();
    if(!modelReady||!sourceReady){release(current.root);return false;}
    return true;
  };
  return{
    prepare(sourcePrisms){
      if(disposed)return false;
      const entry=federalMinistryCentralPlanV321();
      const next=createExactOwnersSourceV321(entry.plan,sourcePrisms,entry.control);
      if(!next){release();source=null;expectedOwners=[];return false;}
      // A later mode may load a fresh but byte-identical source array. Keep a
      // still-valid live transaction; stale/previously released receipts can
      // acquire the newly verified input without retaining an invalid binding.
      if(!(source&&live&&sync())){release();source=next;}
      expectedOwners=entry.plan.owners.map(owner=>owner.id);
      return true;
    },
    *stageSteps(root,hooks={}){
      if(disposed||!source||!expectedOwners.length||pending||!admitted())return false;
      if(live?.root===root&&sync())return true;
      if(live)release();
      const originalPose=pose(root);
      if(!frameReady(root,originalPose)||owners.has(root)&&owners.get(root)!==token)return false;
      const work={root,cancelled:false};pending=work;owners.set(root,token);
      let tx:ExactOwnersTransactionV321|null=null,delivered=false;
      const gate=()=>!work.cancelled&&admitted()&&frameReady(root,originalPose)&&owners.get(root)===token;
      try{
        tx=yield*stageExactOwnersV321Steps(root,source,gate,hooks);
        // A central civic host is never an absent progressive batch. Require
        // the complete actual five-band + ink owner before retiring anything.
        if(!tx||tx.activeOwners.length!==expectedOwners.length||
          expectedOwners.some(owner=>!tx!.activeOwners.includes(owner))||!tx.prepared()||!tx.commit(gate)||!tx.complete())return false;
        live={root,pose:originalPose,tx};delivered=true;return true;
      }finally{
        if(pending===work)pending=null;
        if(!delivered){tx?.rollback();if(owners.get(root)===token)owners.delete(root);}
      }
    },
    sync,release,
    dispose(){if(disposed)return;release();source=null;expectedOwners=[];disposed=true;},
  };
}
