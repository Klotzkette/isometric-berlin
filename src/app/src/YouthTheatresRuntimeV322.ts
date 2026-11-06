/** One atomic authored-source lifetime for the complete EastParks family. */
import{Box3,Group,Mesh,type Material}from"three";
import{createArchenholdV322Steps,hasCompleteArchenholdV322,disposeArchenholdV322,bindArchenholdSourcesV322,youthTheatreOwnJSONV322}from"./ArchenholdV322";
import{prepareArchenholdPreviousV322Steps}from"./ArchenholdPreviousV322";
import{createNorthCoreTerrainControllerV309,type NorthCoreTerrainRecipesV309,type NorthCoreTerrainTransactionV309,type NorthCoreTerrainRebindV309}from"./NorthCoreTerrainV309";
import{prepareMemorialPreviousV322,memorialAccuracySourceRowsV322,hasMemorialAccuracySourceRowsV322}from"./MemorialPreviousV322";
import{createMemorialAccuracyV322Steps,hasCompleteMemorialAccuracyV322,memorialAccuracySolidAtV322}from"./MemorialAccuracyV322";
import{freezeStaticSceneTransforms}from"./staticSceneTransforms";
import{archenholdNavigationV322}from"./youthTheatresV322Navigation";
import joint from"./data/eastParksJointPreviousV322.json";
const controller=createNorthCoreTerrainControllerV309({"drawn-worker":490293044,minecraft:858062205});
const hash=(q:unknown)=>{const s=JSON.stringify(q);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const pose=(g:Group)=>[...g.position.toArray(),...g.quaternion.toArray(),...g.scale.toArray(),...g.matrix.elements,+g.matrixAutoUpdate,+g.matrixWorldAutoUpdate];
function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh){resources.add(o.geometry);if((o as any).isInstancedMesh)resources.add(o as any);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m)resources.add(m as Material);}});for(const r of resources)r.dispose();root.clear();}
export type YouthTheatresRuntimeV322={root:Group;complete():boolean;release():void;solidAt(x:number,y:number,z:number,radius?:number):boolean;groundAt(x:number,z:number,currentY?:number):number|null;previousOwnerRetired(owner:string):boolean};
/** Must finish before the synchronous generator starts; no new public fetch. */
export async function prepareYouthTheatresRuntimeV322(native=false,includeTreptow=false):Promise<boolean>{return !includeTreptow||hash(joint)===660074104&&await prepareMemorialPreviousV322(native,{keys:["treptow"]});}
export function* createYouthTheatresRuntimeV322Steps(oldRoot:Group,native:boolean,sourceBuildings:readonly unknown[],options:{mobileLike?:boolean;beforeSwap?:NorthCoreTerrainRebindV309;afterSwap?:()=>void;includeTreptow?:boolean}={}):Generator<void,YouthTheatresRuntimeV322|null>{
 let model:Group|null=null,arche:Group|null=null,memorial:Group|null=null,tx:NorthCoreTerrainTransactionV309|null=null,delivered=false,released=false;
 const release=()=>{if(released)return;released=true;tx?.rollback();if(model){model.removeFromParent();dispose(model);}options.afterSwap?.();};
 try{const sourceProof=bindArchenholdSourcesV322(sourceBuildings);if(!sourceProof)return null;
  arche=yield*createArchenholdV322Steps(native,{sourceBuildings,mobileLike:options.mobileLike});if(!arche)return null;model=arche;
  let modelProof=()=>!!arche&&sourceProof()&&hasCompleteArchenholdV322(arche,native);
  if(options.includeTreptow){if(hash(joint)!==660074104)return null;const rows=memorialAccuracySourceRowsV322(native,["treptow"]);if(!rows||rows.length!==1||youthTheatreOwnJSONV322(rows[0].cenotaphs)!==youthTheatreOwnJSONV322(joint.sourceCenotaphs))return null;
   model=new Group();model.name="Complete EastParks Archenhold and Treptow V322";model.add(arche);
   memorial=yield*createMemorialAccuracyV322Steps(native,{keys:["treptow"],sourceRows:rows,mobileLike:options.mobileLike},r=>model!.add(r));if(!memorial)return null;
   freezeStaticSceneTransforms(model);const shape=pose(model);modelProof=()=>!!model&&!!arche&&!!memorial&&sourceProof()&&model.children.length===2&&model.children[0]===arche&&model.children[1]===memorial&&arche.parent===model&&memorial.parent===model&&pose(model).every((v,i)=>Object.is(v,shape[i]))&&hasCompleteArchenholdV322(arche,native)&&hasMemorialAccuracySourceRowsV322(rows,native,["treptow"])&&hasCompleteMemorialAccuracyV322(memorial,native,["treptow"]);
   tx=yield*controller.prepareSteps(oldRoot,native,modelProof,joint.recipes as unknown as NorthCoreTerrainRecipesV309);
  }else tx=yield*prepareArchenholdPreviousV322Steps(oldRoot,native,arche,sourceBuildings);
  if(!tx)return null;
  oldRoot.add(model);if(!tx.commit(()=>model!.parent===oldRoot&&modelProof(),options.beforeSwap))return null;options.afterSwap?.();const nav=archenholdNavigationV322(arche,native)!;
  const boxes=[new Box3().setFromObject(arche),...(memorial?[new Box3().setFromObject(memorial)]:[])],near=(x:number,y:number|undefined,z:number,r=0)=>boxes.some(b=>x+r>=b.min.x&&x-r<=b.max.x&&z+r>=b.min.z&&z-r<=b.max.z&&(y===undefined||y+r>=b.min.y&&y-r<=b.max.y));
  const runtime:YouthTheatresRuntimeV322={root:model,complete(){if(released)return false;if(!model||model.parent!==oldRoot||!modelProof()||!tx?.complete()){release();return false;}return true;},release,solidAt(x,y,z,radius=0){return near(x,y,z,radius)&&runtime.complete()&&(nav.solidAt(x,y,z,radius)||!!memorial&&memorialAccuracySolidAtV322(memorial,x,y,z,radius));},groundAt(x,z,currentY){return near(x,undefined,z)&&runtime.complete()?nav.groundAt(x,z,currentY):null;},previousOwnerRetired(owner){return joint.sourceBuildings.some(p=>p.id===owner)&&runtime.complete();}};
  delivered=true;return runtime;
 }finally{if(!delivered){release();if(arche&&arche!==model&&!arche.parent)disposeArchenholdV322(arche);}}
}
