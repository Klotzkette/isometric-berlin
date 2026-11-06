/** A single actual authored family owns its reversible memorial replacement. */
import {Group,type Object3D,type Material,type BufferGeometry} from 'three';
import {composeExactOwnersSourcesV321Steps,createExactOwnersSourceV321Steps,stageExactOwnersV321Steps,type ExactOwnersHooksV321,type ExactOwnersTransactionV321} from './ExactOwnersV321';
import {memorialPreviousPlansV322,memorialAccuracySourceRowsV322,type MemorialSiteKeyV322} from './MemorialPreviousV322';
import {createMemorialAccuracyV322Steps,hasCompleteMemorialAccuracyV322,memorialAccuracySolidAtV322,memorialAccuracyMayContainV322} from './MemorialAccuracyV322';
const owners=new WeakMap<Object3D,symbol>();
const pose=(o:Object3D)=>[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,+o.matrixAutoUpdate,+o.matrixWorldAutoUpdate];
const samePose=(o:Object3D,p:readonly number[])=>pose(o).every((v,i)=>Object.is(v,p[i]));
function dispose(root:Group){const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();root.traverse(o=>{const m=o as any;if(m.geometry)geometries.add(m.geometry);if(m.isInstancedMesh)m.dispose();for(const v of[m.material,m.userData.dayMaterial,m.userData.nightMaterial,m.userData.schwellenraumMaterial].flat())if(v?.dispose)materials.add(v);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();}
export type MemorialRuntimeV322={root:Group;native:boolean;keys:readonly MemorialSiteKeyV322[];
 /** Call immediately after the actual old family is attached. */
 activate:(expectedParent?:Object3D)=>boolean;
 complete:()=>boolean;solidAt:(x:number,y:number,z:number,radius?:number)=>boolean;
 /** Synchronous permanent closure; restores every old source before disposal. */
 rollback:()=>void;release:()=>void;
};
type Options={keys:readonly MemorialSiteKeyV322[];mobileLike?:boolean;hooks?:ExactOwnersHooksV321;isCancelled?:()=>boolean};
/** Source preparation is deliberately the existing async caller's step. This
 * generator never fetches, substitutes source rows or promotes old weak data. */
export function* createMemorialRuntimeV322Steps(oldRoot:Group,native:boolean,options:Options,onCreate?:(root:Group)=>void):Generator<void,MemorialRuntimeV322|null>{
 if(!oldRoot?.isGroup||owners.has(oldRoot)||!options||!Array.isArray(options.keys))return null;
 const combined=(options.keys.length===3||options.keys.length===5&&options.keys[3]==="french"&&options.keys[4]==="british")&&options.keys[0]==="berlin"&&options.keys[1]==="pyramide"&&options.keys[2]==="cadillacs";if(!combined&&!(options.keys.length===1&&["berlin","schoenholz","treptow"].includes(options.keys[0])))return null;
 const keys=[...options.keys],rows=memorialAccuracySourceRowsV322(native,keys),plans=memorialPreviousPlansV322(native,keys);
 if(!rows||plans.length!==(native&&(combined||keys[0]==='berlin')?0:combined?2:1)||plans.some(p=>p.groupName!==oldRoot.name)||!plans.length&&oldRoot.name!=='Berlin outline landmark additions v182')return null;
 const token=Symbol('Private memorial family owner v322'),oldPose=pose(oldRoot);let expectedParent=oldRoot.parent,parentPose=expectedParent?pose(expectedParent):null,activated=!!expectedParent,closed=false,delivered=false,root:Group|null=null,tx:ExactOwnersTransactionV321|null=null;
 owners.set(oldRoot,token);
 const cancelled=()=>{try{return options.isCancelled?.()===true;}catch{return true;}};
 const contents=()=>!closed&&!cancelled()&&owners.get(oldRoot)===token&&oldRoot.visible&&samePose(oldRoot,oldPose)&&(!activated||oldRoot.parent===expectedParent&&!!expectedParent&&!!parentPose&&samePose(expectedParent,parentPose))&&!!root&&root.parent===oldRoot&&hasCompleteMemorialAccuracyV322(root,native,keys);
 const rollback=()=>{if(closed)return;closed=true;tx?.rollback();if(owners.get(oldRoot)===token)owners.delete(oldRoot);if(root){oldRoot.remove(root);dispose(root);}};
 const complete=()=>{const sourceOkay=tx?.complete()??plans.length===0;const valid=activated&&contents()&&sourceOkay;if(!valid&&activated)rollback();return valid;};
 try{
  root=yield*createMemorialAccuracyV322Steps(native,{keys,sourceRows:rows,mobileLike:options.mobileLike},onCreate);if(!root||cancelled())return null;
  oldRoot.add(root);if(!contents())return null;
  if(plans.length){const source=plans.length===1?yield*createExactOwnersSourceV321Steps(plans[0].plan,rows,plans[0].control):yield*composeExactOwnersSourcesV321Steps(plans,rows);if(!source||!contents())return null;
   tx=yield*stageExactOwnersV321Steps(oldRoot,source,contents,options.hooks);if(!tx||tx.activeOwners.length!==plans.reduce((n,p)=>n+p.plan.owners.length,0)||plans.some(p=>p.plan.owners.some(o=>!tx!.activeOwners.includes(o.id)))||!tx.commit(contents)||!tx.complete())return null;
   yield*tx.parkRetiredSourcesSteps();if(!contents()||!tx.complete())return null;
  }
  const bundle:MemorialRuntimeV322={root,native,keys,activate(parent){if(closed)return false;const actual=oldRoot.parent;if(!actual||parent&&actual!==parent){rollback();return false;}if(activated&&actual!==expectedParent){rollback();return false;}expectedParent=actual;parentPose=pose(actual);activated=true;return complete();},complete,solidAt(x,y,z,radius=0){return memorialAccuracyMayContainV322(root!,x,y,z,radius)&&complete()&&memorialAccuracySolidAtV322(root!,x,y,z,radius);},rollback,release:rollback};
  if(activated&&!complete())return null;delivered=true;return bundle;
 }catch{return null;}finally{if(!delivered)rollback();}
}
