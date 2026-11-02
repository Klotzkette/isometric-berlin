/** Complete immutable controls for later source halls and Mauerpark line relief. */
import {restoreLegacyInstances,type InstanceBufferDelta} from "./instanceBufferReplay";
import {expect} from "bun:test";
import {BufferAttribute, InstancedBufferAttribute, type Object3D} from "three";
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import proof from "../fixtures/native-history-v299-replay.json";
import {geometryPreservationV206} from "./geometryPreservationV206";
import {staticGeometryAudit} from "./staticGeometryAudit";
import {assertNativeHistorySourcesV299} from "./sourceHistoryV299";
const sha=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Every old node stays live. Only fully hashed additions and individually
 * captured attributes are inverted, and the complete prior tree is checked. */
export function restoreFamilyBeforeV281<T extends Object3D>(root:T,family:"expanded"|"boundaries-drawn"|"boundaries-native"):()=>void{
  assertNativeHistorySourcesV299();const records=geometryPreservationV206(root),digest=sha(records);
  const stage=family==="expanded"?[proof.families["expanded-full"],proof.families["expanded-mobile"]].find(s=>s.afterRecordsSha256===digest):proof.families[family];
  expect(stage).toBeDefined();expect(digest).toBe(stage!.afterRecordsSha256);expect(staticGeometryAudit(root)).toEqual(stage!.afterStatic);
  const nodes:any[]=[];root.traverse(o=>nodes.push(o));const byKey=new Map(records.map((r,i)=>[r.key,{record:r,node:nodes[i]}]));
  const excluded=new Set([...stage!.added.map(r=>r.key),...stage!.changes.map(c=>c.after.key)]);
  expect(sha(records.filter(r=>!excluded.has(r.key)))).toBe(stage!.unchangedSha256);
  const undo:(()=>void)[]=[];
  try{
    for(const change of stage!.changes){const item=byKey.get(change.after.key)!;expect(item.record).toEqual(change.after);const geometry=item.node.geometry;
      if("instances"in change){const p=change.instances as {bytes:number;sha256:string;gzip:string};const raw=gunzipSync(Buffer.from(p.gzip,"base64"));expect(raw.byteLength).toBe(p.bytes);expect(createHash("sha256").update(raw).digest("hex")).toBe(p.sha256);const mesh=item.node,delta=JSON.parse(raw.toString()) as InstanceBufferDelta,prior=restoreLegacyInstances(mesh,delta);const m=mesh.instanceMatrix,c=mesh.instanceColor,count=mesh.count;mesh.instanceMatrix=new InstancedBufferAttribute(prior.instanceMatrix.array,16,m.normalized).setUsage(m.usage);mesh.instanceColor=new InstancedBufferAttribute(prior.instanceColor!.array,3,c.normalized).setUsage(c.usage);mesh.count=prior.count;undo.push(()=>{mesh.instanceMatrix=m;mesh.instanceColor=c;mesh.count=count});}
      for(const [field,delta]of Object.entries(change.stateChanges ?? {})){const d=delta as {before:any;after:any};const node=item.node;
        if(field==="materials"){const materials=Array.isArray(node.material)?node.material:[node.material];const saved=materials.map((m:any,i:number)=>Object.fromEntries(Object.keys(d.before[i]).map(k=>[k,m[k]?.isColor?m[k].toArray():m[k]])));const apply=(values:any[])=>values.forEach((value,i)=>Object.entries(value).forEach(([key,v])=>{if(materials[i][key]?.isColor)materials[i][key].fromArray(v);else materials[i][key]=v;}));apply(d.before);undo.push(()=>apply(saved));}
        else if(["position","rotation","scale","matrix"].includes(field)){const saved=node[field].toArray();node[field].fromArray(d.before);undo.push(()=>node[field].fromArray(saved));}
        else if(field==="groups"||field==="drawRange"){const saved=geometry[field];geometry[field]=structuredClone(d.before);undo.push(()=>geometry[field]=saved);}
        else{const saved=node[field];node[field]=d.before;undo.push(()=>node[field]=saved);}
      }
      for(const [name,packed]of Object.entries({...change.attributes,...("index"in change?{index:change.index}:{})})){const p=packed as {type:string;itemSize:number;normalized:boolean;bytes:number;sha256:string;gzip:string};const live=name==="index"?geometry.index:geometry.getAttribute(name);const raw=gunzipSync(Buffer.from(p.gzip,"base64"));expect(raw.byteLength).toBe(p.bytes);expect(createHash("sha256").update(raw).digest("hex")).toBe(p.sha256);const types={Float32Array,Uint8Array,Uint16Array,Uint32Array};const Type=types[p.type as keyof typeof types];expect(Type).toBeDefined();const data=new ArrayBuffer(raw.byteLength);new Uint8Array(data).set(raw);const attr=new BufferAttribute(new Type(data),p.itemSize,p.normalized);
        if(name==="index"){geometry.setIndex(attr);undo.push(()=>geometry.setIndex(live));}else{geometry.setAttribute(name,attr);undo.push(()=>geometry.setAttribute(name,live));}
      }
    }
    for(const addition of stage!.added){const item=byKey.get(addition.key)!;expect(item.record).toEqual(addition);const parent=item.node.parent,children=parent.children;parent.children=children.filter((n:any)=>n!==item.node);undo.push(()=>{parent.children=children});}
    expect(sha(geometryPreservationV206(root))).toBe(stage!.beforeRecordsSha256);expect(staticGeometryAudit(root)).toEqual(stage!.beforeStatic);
  }catch(error){undo.reverse().forEach(fn=>fn());throw error;}
  return()=>undo.reverse().forEach(fn=>fn());
}
