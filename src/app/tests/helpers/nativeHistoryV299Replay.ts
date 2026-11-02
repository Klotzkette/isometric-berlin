/** Reversible live-buffer projection through independently captured Git worlds. */
import {expect} from "bun:test";
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {BufferAttribute,BufferGeometry,Group,InstancedBufferAttribute,InstancedMesh,InterleavedBuffer,InterleavedBufferAttribute} from "three";
import proof from "../fixtures/native-history-v299-replay.json";
import {coreRecordsV281,hashCoreV281} from "./coreMaterialV281";
import {snapshotV211} from "./coreMaterialV211";
import {restoreLegacyInstances,type InstanceBufferDelta} from "./instanceBufferReplay";
import {assertNativeHistorySourcesV299} from "./sourceHistoryV299";

type PackedAttribute={type:string;itemSize:number;normalized:boolean;bytes:number;sha256:string;gzip:string};
const unpack=(p:PackedAttribute):BufferAttribute=>{
  const raw=gunzipSync(Buffer.from(p.gzip,"base64"));expect(raw.byteLength).toBe(p.bytes);expect(createHash("sha256").update(raw).digest("hex")).toBe(p.sha256);
  const Types={Float32Array,Uint8Array,Uint16Array,Uint32Array};const Type=Types[p.type as keyof typeof Types];expect(Type).toBeDefined();
  const buffer=new ArrayBuffer(raw.byteLength);new Uint8Array(buffer).set(raw);return new BufferAttribute(new Type(buffer),p.itemSize,p.normalized);
};
export const nativeInstanceDeltaV299=(p:{bytes:number;sha256:string;gzip:string}):InstanceBufferDelta=>{
  const raw=gunzipSync(Buffer.from(p.gzip,"base64"));expect(raw.byteLength).toBe(p.bytes);expect(createHash("sha256").update(raw).digest("hex")).toBe(p.sha256);return JSON.parse(raw.toString("utf8"));
};

/** New owners are fully counted and hashed before their exact temporary
 * exclusion. All changed old instance rows and merged attributes are restored,
 * then the entire historical world must reproduce its immutable old snapshot. */
export function withNativeHistoryBeforeV281<T>(root:Group,profile:"full"|"mobile",inspect:()=>T):T{
  assertNativeHistorySourcesV299();const undo:(()=>void)[]=[],made:BufferGeometry[]=[];
  try{
    for(const stage of proof.profiles[profile]){
      const records=coreRecordsV281(root),objects:any[]=[];root.traverse((o:any)=>{if(o.isMesh||o.isLineSegments)objects.push(o)});
      expect(hashCoreV281(records)).toBe(stage.afterRecordsSha256);expect(snapshotV211(root)).toEqual(stage.afterSnapshot);
      const byKey=new Map(records.map((r,i)=>[r.key,{record:r,node:objects[i]}]));
      const excluded=new Set([...stage.added.map(r=>r.key),...stage.changes.map(r=>r.after.key)]);
      const retained=records.filter(r=>!excluded.has(r.key));expect(retained).toHaveLength(stage.unchangedCount);expect(hashCoreV281(retained)).toBe(stage.unchangedSha256);
      for(const change of stage.changes){
        const item=byKey.get(change.after.key)!;expect(item.record).toEqual(change.after);const mesh=item.node;
        if("instances"in change){
          expect(mesh).toBeInstanceOf(InstancedMesh);const prior=restoreLegacyInstances(mesh,nativeInstanceDeltaV299(change.instances));
          const m=mesh.instanceMatrix,c=mesh.instanceColor,count=mesh.count;undo.push(()=>{mesh.instanceMatrix=m;mesh.instanceColor=c;mesh.count=count});
          mesh.instanceMatrix=new InstancedBufferAttribute(prior.instanceMatrix.array,16,m.normalized).setUsage(m.usage);
          mesh.instanceColor=new InstancedBufferAttribute(prior.instanceColor!.array,3,c.normalized).setUsage(c.usage);mesh.count=prior.count;
        }else{
          const original=mesh.geometry,next=new BufferGeometry();next.groups=original.groups.map((g:any)=>({...g}));next.drawRange={...original.drawRange};
          for(const[name,attr]of Object.entries(change.attributes)){
            const restored=unpack(attr as PackedAttribute),live=original.getAttribute(name);
            next.setAttribute(name,live.isInterleavedBufferAttribute?new InterleavedBufferAttribute(new InterleavedBuffer(restored.array,live.data.stride),restored.itemSize,live.offset,restored.normalized):restored);
          }
          if(change.index)next.setIndex(unpack(change.index as PackedAttribute));mesh.geometry=next;made.push(next);undo.push(()=>{mesh.geometry=original});
        }
      }
      for(const addition of stage.added){const item=byKey.get(addition.key)!;expect(item.record).toEqual(addition);const parent=item.node.parent,children=parent.children;undo.push(()=>{parent.children=children});parent.children=children.filter((c:any)=>c!==item.node);}
      const children=root.children;undo.push(()=>{root.children=children});
      const used=new Set<object>();root.children=stage.beforeRootChildren.map(name=>{const node=children.find(c=>c.name===name&&!used.has(c));expect(node).toBeDefined();used.add(node!);return node!;});
      const replayed=coreRecordsV281(root);
      expect(hashCoreV281(replayed)).toBe(stage.beforeRecordsSha256);expect(snapshotV211(root)).toEqual(stage.beforeSnapshot);
    }
    return inspect();
  }finally{for(const restore of undo.reverse())restore();for(const geometry of made)geometry.dispose();}
}

/** Standalone seven-batch control: four owner-photo transoms and the exact
 * later HBF source-opening/compaction delta account for every changed row. */
export function withNativeArchitectureBeforeV281<T>(root:Group,inspect:()=>T):T{
  assertNativeHistorySourcesV299();const stage=proof.architecture,undo:(()=>void)[]=[];
  try{
    const records=coreRecordsV281(root);expect(hashCoreV281(records)).toBe(stage.afterRecordsSha256);
    const excluded=new Set(stage.changes.map(c=>c.after.key));expect(hashCoreV281(records.filter(r=>!excluded.has(r.key)))).toBe(stage.unchangedSha256);
    const nodes:any[]=[];root.traverse((o:any)=>{if(o.isMesh||o.isLineSegments)nodes.push(o)});
    const byKey=new Map(records.map((r,i)=>[r.key,{record:r,node:nodes[i]}]));
    for(const change of stage.changes){const item=byKey.get(change.after.key)!;expect(item.record).toEqual(change.after);const mesh=item.node as InstancedMesh,delta=nativeInstanceDeltaV299(change.instances),prior=restoreLegacyInstances(mesh,delta);
      if(mesh.userData.landmarkId==="berlin-hauptbahnhof")expect(delta.beforeCount-delta.afterCount).toBe(261);
      if(mesh.userData.landmarkId==="reichstag"){expect(delta.removed).toHaveLength(0);expect(delta.added).toHaveLength(4);}
      const m=mesh.instanceMatrix,c=mesh.instanceColor!,count=mesh.count;undo.push(()=>{mesh.instanceMatrix=m;mesh.instanceColor=c;mesh.count=count});mesh.instanceMatrix=new InstancedBufferAttribute(prior.instanceMatrix.array,16,m.normalized);mesh.instanceColor=new InstancedBufferAttribute(prior.instanceColor!.array,3,c.normalized);mesh.count=prior.count;
    }
    expect(hashCoreV281(coreRecordsV281(root))).toBe(stage.beforeRecordsSha256);expect(snapshotV211(root)).toEqual(stage.beforeSnapshot);return inspect();
  }finally{for(const restore of undo.reverse())restore();}
}

/** Later full-height HBF terrain ownership replaced its earlier short boundary.
 * Validate all unchanged live rows and both full buffers before the old audits. */
export function nativeGroundBeforeV281(mesh:InstancedMesh):InstancedMesh{
  assertNativeHistorySourcesV299();const stage=proof.ground;
  const hash=(m:InstancedMesh)=>createHash("sha256").update(m.instanceMatrix.array).update(m.instanceColor!.array).digest("hex");
  if(mesh.count===185228){expect(hash(mesh)).toBe(stage.beforeSha256);return mesh;}
  expect(hash(mesh)).toBe(stage.afterSha256);const delta=nativeInstanceDeltaV299(stage.instances);expect(delta.beforeCount).toBe(185228);expect(delta.afterCount).toBe(185274);
  const prior=restoreLegacyInstances(mesh,delta);expect(hash(prior)).toBe(stage.beforeSha256);return prior;
}
