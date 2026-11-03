/** Two measured road decks and their complete visible lower rail floors. */
import {Group,type Object3D} from 'three';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {createGesundbrunnenBridgeInkModelV309,adoptGesundbrunnenBridgeInkModelV309,hasCompleteGesundbrunnenBridgeInkModelV309} from './GesundbrunnenBridgeInkV309';
import source from './data/gesundbrunnenRoadBridgesV309.json';
import lowerFloor from './data/railBridgeUnderdeckApproachV309.json';
import {createRailBridgeApproachStepsV309,hasCompleteRailBridgeApproachV307} from './RailBridgeApproachV307';
import {createRailBridgeApproachNavigationV307} from './railBridgeApproachNavigationV307';
import {createPackedRootStepsV309,completePackedRootV307,type RequiredPackedV307} from './requiredPackedRootV307';
const owner=Symbol('Complete measured Gesundbrunnen road and lower floor v309');
type Pose={object:Object3D;matrix:number[];position:number[];quaternion:number[];scale:number[];auto:boolean;worldAuto:boolean};
const receipts=new WeakMap<Group,{body:Group;ink:Group;approach:Group;navigation:ReturnType<typeof createRailBridgeApproachNavigationV307>;poses:Pose[]}>();
const pose=(object:Object3D):Pose=>({object,matrix:object.matrix.elements.slice(),position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray(),auto:object.matrixAutoUpdate,worldAuto:object.matrixWorldAutoUpdate});
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function intact(p:Pose):boolean{return same(p.object.matrix.elements,p.matrix)&&same(p.object.position.toArray(),p.position)&&same(p.object.quaternion.toArray(),p.quaternion)&&same(p.object.scale.toArray(),p.scale)&&p.object.matrixAutoUpdate===p.auto&&p.object.matrixWorldAutoUpdate===p.worldAuto;}
/** Actual source resources, not public labels, admit the complete paired model. */
function disposeRequiredRoot(root:Group):void{
 const resources=new Set<{dispose():void}>();root.traverse(o=>{
  if('geometry'in o)resources.add((o as unknown as{geometry:{dispose():void}}).geometry);
  if('material'in o)for(const material of[(o as unknown as{material:{dispose():void}|{dispose():void}[]}).material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(material&&typeof material.dispose==='function')resources.add(material);
 });for(const resource of resources)resource.dispose();root.clear();
}
/** Detached early ownership and per-mesh yields preserve cancellation cleanup. */
export function* createGesundbrunnenRoadBridgesStepsV309(native=false,_options:{mobileLike?:boolean}={},onCreate?:(root:Group)=>void):Generator<void,Group>{
 const root=new Group();root.name='Measured Badstraßenbrücke and Swinemünder Brücke v309';root.userData={textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,requiredCompleteReplacement:true};onCreate?.(root);let delivered=false;
 try{
  yield;
  const models=[...source.models,...lowerFloor.models] as unknown as RequiredPackedV307[];
  if(source.schemaVersion!==1||lowerFloor.schemaVersion!==1||lowerFloor.models.length!==8||models.some(q=>!['gesundbrunnen','bridge-approach-v307','bridge-approach-v307:lower'].includes(q.field??'')))throw Error('Missing complete bridge and underdeck source');
  const selected=models.filter(q=>q.native===native),metadata=source as unknown as{contactSourceSha256?:string;modelCounts?:{drawn:number;minecraft:number}};
  if(!metadata.contactSourceSha256||metadata.contactSourceSha256!==lowerFloor.sourceSha256||source.models.filter(q=>q.native===native).length!==metadata.modelCounts?.[native?'minecraft':'drawn']||lowerFloor.models.filter(q=>q.native===native).length!==4)throw Error('Bridge/floor source partition or complete family count does not match');
  if(selected.length<8||!selected.some(q=>q.key.includes('badstrasse'))||!selected.some(q=>q.key.includes('swinemuende'))||selected.filter(q=>q.key.includes('underdeck')).length<3)throw Error('Incomplete paired bridge floor');
  const body=yield*createPackedRootStepsV309(owner,'Measured Badstraßenbrücke and Swinemünder Brücke bodies v309',native,selected,{publicRoadDecks:2,requiredLowerRailFloor:true,sourceBoundPaint:true},child=>root.add(child));
  const ink=createGesundbrunnenBridgeInkModelV309(native);root.add(ink);if(!adoptGesundbrunnenBridgeInkModelV309(ink))throw Error('Required exact curb ink did not attach');yield;
  const approach=yield*createRailBridgeApproachStepsV309(native,child=>root.add(child));freezeStaticSceneTransforms(root);
  const navigation=createRailBridgeApproachNavigationV307(approach,native),poses:Pose[]=[];root.traverse(o=>poses.push(pose(o)));receipts.set(root,{body,ink,approach,navigation,poses});delivered=true;return root;
 }finally{if(!delivered){receipts.delete(root);disposeRequiredRoot(root);}}
}
/** Same full synchronous API for static index and isolated source tests. */
export function createGesundbrunnenRoadBridgesV309(native=false,options:{mobileLike?:boolean}={}):Group{
 const steps=createGesundbrunnenRoadBridgesStepsV309(native,options);for(;;){const next=steps.next();if(next.done)return next.value;}
}
export function hasCompleteGesundbrunnenRoadBridgesV309(root:Group,native?:boolean):boolean {
 const r=receipts.get(root);return !!r&&root.visible&&root.children.length===3&&root.children[0]===r.body&&root.children[1]===r.ink&&root.children[2]===r.approach&&r.body.parent===root&&r.ink.parent===root&&r.approach.parent===root&&r.poses.every(intact)&&hasCompleteGesundbrunnenBridgeInkModelV309(r.ink,native)&&hasCompleteRailBridgeApproachV307(r.approach,native)&&completePackedRootV307(r.body,owner,native);
}

/** Navigation remains bound to the exact private complete approach buffers. */
export function gesundbrunnenBridgeApproachNavigationV309(root:Group,native=false){
 const r=receipts.get(root);return r&&hasCompleteGesundbrunnenRoadBridgesV309(root,native)?r.navigation:null;
}
