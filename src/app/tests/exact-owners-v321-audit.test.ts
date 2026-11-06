/** Independent retention/admission regressions for the finite owner transfer. */
import {expect,test} from "bun:test";
import {BoxGeometry,BufferAttribute,BufferGeometry,Group,InstancedMesh,LineBasicMaterial,LineSegments,Matrix4,Mesh,MeshBasicMaterial} from "three";
import {createExactOwnersSourceV321,stageExactOwnersV321,type ExactComponentV321,type ExactOwnersPlanV321} from "../src/ExactOwnersV321";
const bytes=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
function control(p:unknown){const s=JSON.stringify(p);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;}
function part(o:Mesh|LineSegments):ExactComponentV321{return{name:o.name,kind:o instanceof InstancedMesh?"instances":o instanceof LineSegments?"lines":"mesh",retire:true,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,{type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,bytes:bytes(a.array)}])),index:o.geometry.index?{type:o.geometry.index.array.constructor.name,bytes:bytes(o.geometry.index.array)}:null,instances:o instanceof InstancedMesh?{count:o.count,matrix:bytes(o.instanceMatrix.array),color:o.instanceColor?bytes(o.instanceColor.array):null}:null};}
function triangle(x:number){const g=new BufferGeometry();g.setAttribute("position",new BufferAttribute(new Float32Array([x,-0,0,x+1,0,0,x,1,0]),3));g.setAttribute("normal",new BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));g.setAttribute("color",new BufferAttribute(new Uint8Array([111,122,133,111,122,133,111,122,133]),3,true));g.setIndex([0,1,2]);return g;}
function fixture(){
 const root=new Group(),body=new Mesh(triangle(0),new MeshBasicMaterial({vertexColors:true}));body.name="LoD2 prism buildings";
 const line=new LineSegments(new BufferGeometry(),new LineBasicMaterial());line.name="LoD2 facade axes";line.geometry.setAttribute("position",new BufferAttribute(new Float32Array([0,3,0,0,8,0]),3));line.geometry.setIndex([0,1]);
 const windows=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),1);windows.name="LoD2 facade night strips";windows.setMatrixAt(0,new Matrix4().makeTranslation(3,4,5));
 const rows=[{id:"owner-a",ring:[[0,0],[30,0],[30,30],[0,30]],holes:[],y0_dm:30,h_dm:100,class:0,roof:1000}];
 const plan:ExactOwnersPlanV321={schemaVersion:1,native:false,owners:[{id:rows[0].id,sourcePrism:structuredClone(rows[0]),components:[part(body),part(line),part(windows)]}]};
 const selected=triangle(0),foreign=triangle(20);for(const key of["position","normal","color"]){const a=selected.getAttribute(key),b=foreign.getAttribute(key),Type=a.array.constructor as typeof Float32Array;body.geometry.setAttribute(key,new BufferAttribute(new Type([...a.array,...b.array]),a.itemSize,a.normalized));}body.geometry.setIndex([0,1,2,3,4,5]);
 line.geometry.setAttribute("position",new BufferAttribute(new Float32Array([0,3,0,0,8,0,20,3,0,20,8,0]),3));line.geometry.setIndex([0,1,2,3]);
 const allWindows=new InstancedMesh(windows.geometry,windows.material,2);allWindows.name=windows.name;allWindows.setMatrixAt(0,new Matrix4().makeTranslation(3,4,5));allWindows.setMatrixAt(1,new Matrix4().makeTranslation(25,4,5));
 root.add(body,line,allWindows);return{root,body,line,windows:allWindows,rows,plan};
}
function receipt(f:ReturnType<typeof fixture>){return createExactOwnersSourceV321(f.plan,f.rows,control(f.plan))!;}

test("a raw foreign index edit after staging is never overwritten by an older prepared copy",()=>{
 const f=fixture(),original=f.body.geometry,tx=stageExactOwnersV321(f.root,receipt(f),true)!;expect(tx).not.toBeNull();
 original.index!.array[3]=4; // Unselected triangle; deliberately no needsUpdate/version bump.
 expect(tx.commit(true)).toBeFalse();expect(f.body.geometry).toBe(original);expect(f.body.geometry.index!.array[3]).toBe(4);
});

test("a raw foreign instance-row edit after staging is never overwritten by an older prepared copy",()=>{
 const f=fixture(),original=f.windows.instanceMatrix,tx=stageExactOwnersV321(f.root,receipt(f),true)!;expect(tx).not.toBeNull();
 original.array[28]=31;
 expect(tx.commit(true)).toBeFalse();expect(f.windows.instanceMatrix).toBe(original);expect(f.windows.instanceMatrix.array[28]).toBe(31);
});

test("raw mutation of published owned words invalidates completion and cannot reuse the receipt",()=>{
 for(const kind of["index","matrix"]){const f=fixture(),oldGeometry=f.body.geometry,oldMatrix=f.windows.instanceMatrix,tx=stageExactOwnersV321(f.root,receipt(f),true)!;expect(tx.commit(true)).toBeTrue();
  if(kind==="index")f.body.geometry.index!.array[1]=1;else f.windows.instanceMatrix.array[0]=1;
  expect(tx.complete()).toBeFalse();expect(tx.commit(true)).toBeFalse();tx.rollback();expect(f.body.geometry).toBe(oldGeometry);expect(f.windows.instanceMatrix).toBe(oldMatrix);
 }
});

test("rare re-commit rejects foreign raw edits and rollback retains those edits beside the original owned rows",()=>{
 for(const kind of["index","matrix"]){const f=fixture(),tx=stageExactOwnersV321(f.root,receipt(f),true)!;expect(tx.commit(true)).toBeTrue();
  if(kind==="index")f.body.geometry.index!.array[3]=4;else f.windows.instanceMatrix.array[28]=31;
  expect(tx.commit(true)).toBeFalse();tx.rollback();
  expect(Array.from(f.body.geometry.index!.array).slice(0,3)).toEqual([0,1,2]);expect(Array.from(f.windows.instanceMatrix.array).slice(0,16)).toEqual(Array.from(new Matrix4().makeTranslation(3,4,5).elements));
  if(kind==="index")expect(f.body.geometry.index!.array[3]).toBe(4);else expect(f.windows.instanceMatrix.array[28]).toBe(31);
 }
});

test("rare re-commit rejects an unversioned raw mutation of an owned normal or colour word",()=>{
 for(const key of["normal","color"]){const f=fixture(),tx=stageExactOwnersV321(f.root,receipt(f),true)!;expect(tx.commit(true)).toBeTrue();
  const attribute=f.body.geometry.getAttribute(key);attribute.array[0]+=1;
  expect(tx.commit(true)).toBeFalse();tx.rollback();expect(f.body.geometry.index!.array[1]).toBe(1);
 }
});

test("a sparse source ring cannot masquerade as the dense original through an enumerable extra key",()=>{
 const f=fixture(),ring=f.rows[0].ring as unknown as Record<string,unknown>,last=f.rows[0].ring[3];delete ring[3];ring.extra=last;
 expect(Object.keys(ring)).toHaveLength(4);expect(f.rows[0].ring).toHaveLength(4);
 expect(createExactOwnersSourceV321(f.plan,f.rows,control(f.plan))).toBeNull();
});

test("a foreign interleaved index layout cannot masquerade as a known render topology",()=>{
 const f=fixture();
 // getX() would see 0,1,2,3,4,5, while the GPU consumes the intervening words.
 f.body.geometry.setIndex(new BufferAttribute(new Uint16Array([0,4,1,4,2,4,3,0,4,0,5,0]),2));
 expect(stageExactOwnersV321(f.root,receipt(f),true)).toBeNull();
});

test("a pre-swap hook cannot change a foreign old word after final source validation",()=>{
 const f=fixture(),old=f.body.geometry;
 const tx=stageExactOwnersV321(f.root,receipt(f),true,{beforeSwap(){old.index!.array[3]=4;}})!;
 expect(tx.commit(true)).toBeFalse();expect(f.body.geometry).toBe(old);expect(f.body.geometry.index!.array[3]).toBe(4);
});

test("two admitted owners in a common host publish once per host and preserve every foreign word and pose",()=>{
 const f=fixture();
 // The second owner is the currently foreign triangle/line/window row.
 const b=new Mesh(triangle(20),f.body.material);b.name=f.body.name;
 const l=new LineSegments(new BufferGeometry(),f.line.material);l.name=f.line.name;l.geometry.setAttribute("position",new BufferAttribute(new Float32Array([20,3,0,20,8,0]),3));l.geometry.setIndex([0,1]);
 const w=new InstancedMesh(f.windows.geometry,f.windows.material,1);w.name=f.windows.name;w.setMatrixAt(0,new Matrix4().makeTranslation(25,4,5));
 const row={...structuredClone(f.rows[0]),id:"owner-b"};f.rows.push(row);f.plan.owners.push({id:row.id,sourcePrism:structuredClone(row),components:[part(b),part(l),part(w)]});
 // Add a third, unrelated body primitive and matrix row to the common hosts.
 const extra=triangle(40);for(const key of["position","normal","color"]){const a=f.body.geometry.getAttribute(key),e=extra.getAttribute(key),Type=a.array.constructor as typeof Float32Array;f.body.geometry.setAttribute(key,new BufferAttribute(new Type([...a.array,...e.array]),a.itemSize,a.normalized));}f.body.geometry.setIndex([0,1,2,3,4,5,6,7,8]);
 const mesh=new InstancedMesh(f.windows.geometry,f.windows.material,3);mesh.name=f.windows.name;mesh.instanceMatrix.array.set(f.windows.instanceMatrix.array);mesh.setMatrixAt(2,new Matrix4().makeTranslation(41,9,8));f.windows.removeFromParent();f.root.add(mesh);
 const geometry=f.body.geometry,attributes=Object.fromEntries(Object.entries(geometry.attributes).map(([k,a])=>[k,{object:a,bytes:bytes(a.array)}])),matrix=mesh.instanceMatrix,oldWords=Array.from(matrix.array),pose=[...f.root.matrix.elements,...f.body.matrix.elements,...mesh.matrix.elements],calls=new Map<string,number>();let updates=0;
 const tx=stageExactOwnersV321(f.root,receipt(f),true,{beforeSwap(o,k){const key=o.uuid+":"+k;calls.set(key,(calls.get(key)??0)+1)},afterSwap(){updates++;}})!;
 expect(tx.activeOwners).toEqual(["owner-a","owner-b"]);expect(tx.commit(true)).toBeTrue();expect(calls.size).toBe(3);expect([...calls.values()]).toEqual([1,1,1]);expect(updates).toBe(1);
 expect(Array.from(f.body.geometry.index!.array)).toEqual([0,0,0,3,3,3,6,7,8]);expect(Array.from(mesh.instanceMatrix.array.slice(32))).toEqual(oldWords.slice(32));
 for(const[k,p]of Object.entries(attributes)){expect(f.body.geometry.getAttribute(k)).toBe(p.object);expect(bytes(p.object.array)).toBe(p.bytes);}expect([...f.root.matrix.elements,...f.body.matrix.elements,...mesh.matrix.elements]).toEqual(pose);
 tx.rollback();expect(f.body.geometry).toBe(geometry);expect(mesh.instanceMatrix).toBe(matrix);expect(updates).toBe(2);
});

test("a live gate change during a swap restores all old hosts atomically",()=>{
 const f=fixture(),geometry=f.body.geometry,matrix=f.windows.instanceMatrix;let open=true;
 const tx=stageExactOwnersV321(f.root,receipt(f),()=>open,{afterSwap(){open=false;}})!;
 expect(tx.commit(()=>open)).toBeFalse();expect(f.body.geometry).toBe(geometry);expect(f.windows.instanceMatrix).toBe(matrix);expect(tx.complete()).toBeFalse();
});

test("owner-local retirement keeps the complete proved roof complement and all foreign triangles",()=>{
 const make=()=>{
  const f=fixture(),parts=[triangle(0),triangle(10),triangle(20)],geometry=new BufferGeometry();
  for(const key of["position","normal","color"]){const a=parts[0].getAttribute(key),Type=a.array.constructor as typeof Float32Array;geometry.setAttribute(key,new BufferAttribute(new Type(parts.flatMap(p=>Array.from(p.getAttribute(key).array))),a.itemSize,a.normalized));}geometry.setIndex([0,1,2,3,4,5,6,7,8]);f.body.geometry=geometry;
  const proofGeometry=new BufferGeometry();for(const key of["position","normal","color"]){const a=geometry.getAttribute(key),Type=a.array.constructor as typeof Float32Array;proofGeometry.setAttribute(key,new BufferAttribute(new Type(Array.from(a.array).slice(0,6*a.itemSize)),a.itemSize,a.normalized));}proofGeometry.setIndex([0,1,2,3,4,5]);
  const proof=new Mesh(proofGeometry,f.body.material);proof.name=f.body.name;f.plan.owners[0].components[0]=part(proof);f.plan.owners[0].components[0].retire=[0];f.plan.owners[0].components[1].retire=false;f.plan.owners[0].components[2].retire=false;
  return f;
 };
 const f=make(),original=f.body.geometry,normal=original.getAttribute("normal"),normalBytes=bytes(normal.array),tx=stageExactOwnersV321(f.root,receipt(f),true)!;expect(tx).not.toBeNull();expect(tx.commit(true)).toBeTrue();
 expect(Array.from(f.body.geometry.index!.array)).toEqual([0,0,0,3,4,5,6,7,8]);expect(f.body.geometry.getAttribute("normal")).toBe(normal);expect(bytes(normal.array)).toBe(normalBytes);tx.rollback();expect(f.body.geometry).toBe(original);
 const partial=make();partial.body.geometry.setIndex([0,1,2,6,7,8]);expect(stageExactOwnersV321(partial.root,receipt(partial),true)).toBeNull();
 for(const invalid of[[0,0],[1,0],[2],[-1]]){const bad=make();bad.plan.owners[0].components[0].retire=invalid;expect(stageExactOwnersV321(bad.root,receipt(bad),true)).toBeNull();}
});
