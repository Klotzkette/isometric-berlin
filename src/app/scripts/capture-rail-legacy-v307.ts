/** Offline actual-constructor full receipts, no viewer dependency. */
import {writeFileSync}from'node:fs';
import {Group,Mesh,InstancedMesh}from'three';
import {createRailStationsV190}from'../src/RailStationsV190';
const bytes=(a:ArrayBufferView)=>{let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;};
const batches=[];
for(const native of[false,true]){
 const root=createRailStationsV190(native),stations=[];
 root.traverse(q=>{if(q instanceof Group&&['Gesundbrunnen','Landsberger Allee'].includes(q.userData.stationName))stations.push({name:q.name,stationName:q.userData.stationName,position:q.position.toArray(),children:q.children.map(c=>{if(!(c instanceof Mesh))throw Error('Unexpected complete legacy station child');return{name:c.name,attributes:Object.fromEntries(Object.entries(c.geometry.attributes).map(([key,a])=>[key,{bytes:bytes(a.array),count:a.count,itemSize:a.itemSize,normalized:a.normalized}])),index:c.geometry.index?{count:c.geometry.index.count,bytes:bytes(c.geometry.index.array)}:null,instanceCount:c instanceof InstancedMesh?c.count:null,matrix:c instanceof InstancedMesh?bytes(c.instanceMatrix.array):null,color:c instanceof InstancedMesh&&c.instanceColor?bytes(c.instanceColor.array):null,dayColor:c.userData.dayMaterial.color.toArray(),nightColor:c.userData.nightMaterial.color.toArray()};})});});
 batches.push({native,stations});root.traverse(c=>{if(c instanceof Mesh){c.geometry.dispose();for(const m of Array.isArray(c.material)?c.material:[c.material])m.dispose();}});
}
writeFileSync('src/data/railSseLegacyV307.json',JSON.stringify({schemaVersion:1,batches})+'\n');
