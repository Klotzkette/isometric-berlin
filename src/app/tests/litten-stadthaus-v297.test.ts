import{expect,test}from"bun:test";
import{readFileSync}from"node:fs";
import{createHash}from"node:crypto";
import{gunzipSync}from"node:zlib";
import{InstancedMesh,Matrix4,BoxGeometry,MeshBasicMaterial,MeshStandardMaterial,Group}from"three";
import data from"../src/data/littenStadthausV297.json";
import packets from"../src/data/littenStadthausV297Packets.json";
import{createLittenStadthausV297,littenStadthausGeometryV297,podewilFacadeRowsV297,hasCompleteLittenStadthausV297}from"../src/LittenStadthausV297";
import{prepareLittenStadthausV297,applyLittenStadthausTrianglesV297,littenStadthausPacketCandidateV297}from"../src/LittenStadthausV297Packets";
import type{SurroundingCityChunk}from"../src/SurroundingCityGeometry";
function finish<T>(it:Generator<void,T>):T{let next=it.next();while(!next.done)next=it.next();return next.value;}
function rawPacket(path:string):SurroundingCityChunk{const raw=readFileSync(new URL(`../../../${path}`,import.meta.url));return JSON.parse((path.endsWith(".gz")?gunzipSync(raw):raw).toString());}
const recipes=packets.packets as Record<string,{packetPath:string;records:{mesh:number;triangles:number[]}[]}>;

test("every previous source file and exact original site record is pinned; the ambiguous dictated place is not invented",()=>{
  for(const[path,sha]of Object.entries(data.sourceReceipts))expect(createHash("sha256").update(readFileSync(new URL(`../../../${path}`,import.meta.url))).digest("hex")).toBe(sha);
  expect(data.sourceOwners).toHaveLength(15);expect(data.sourceOwners).toContain("DEBE01YYK0000626");expect(data.sourceOwners).toContain("DEBE01YYK00005yc");expect(data.sourceOwners).toContain("DEBE01YYK00006oT");
  expect(new Set(data.faces.map(f=>f.key))).toEqual(new Set(["instanz-centre","instanz-north","instanz-south","stadthaus","neues-stadthaus","podewil","verwaltung-c","muenze-court","direktorenhaus","muenze-front"]));
});

test("the actual Instanz return name, shutters, Stadthaus structure and mint fronts are recognisable in both independent families",()=>{
  for(const native of[false,true]){
    const model=littenStadthausGeometryV297(native);
    for(const role of["instanz-north-return-name","instanz-justice-scales","instanz-visible-shutter-hinge","muenze-double-height-pier-joint","muenze-frieze-craft-gesture","muenze-court-industrial-security-bar","stadthaus-source-edge-rustication","stadthaus-existing-window-transom","neues-stadthaus-existing-window-crossbar","podewil-existing-window-crossbar","verwaltung-c-current-south-shade-box"])expect(model.roles[role]).toBeGreaterThan(0);
    expect(model.roles["instanz-north-return-name"]).toBe(native?281:290);
    expect(model.rows.every(r=>[...r.p,...r.s,r.yaw,r.tone].every(Number.isFinite)&&r.s.every(v=>v>0))).toBe(true);
    expect(Math.max(...model.rows.map(r=>r.p[1]+r.s[1]/2))).toBeLessThan(75);
    expect(new Set(model.rows.map(r=>r.sourceId)).size).toBe(13);for(const r of model.rows)expect(data.sourceOwners.includes(r.sourceId)).toBe(true);
  }
});

test("one exact-size texture-free batch, identical full touch buffers, independent cardinal native matrices and bounded storage",()=>{
  for(const native of[false,true]){
    const a=createLittenStadthausV297(native),b=createLittenStadthausV297(native,{mobileLike:true});
    expect(hasCompleteLittenStadthausV297(a)).toBe(true);expect(hasCompleteLittenStadthausV297(b)).toBe(true);expect(a.children).toHaveLength(1);const m=a.children[0]as InstancedMesh,n=b.children[0]as InstancedMesh;
    expect(m.instanceMatrix.array).toEqual(n.instanceMatrix.array);expect(m.instanceColor!.array).toEqual(n.instanceColor!.array);
    expect(m.instanceMatrix.count).toBe(m.count);expect(m.instanceColor!.count).toBe(m.count);expect(m.geometry.getAttribute("uv")).toBeUndefined();
    expect(m.instanceMatrix.array.byteLength+m.instanceColor!.array.byteLength).toBe(native?905312:519308);
    const matrix=new Matrix4();for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);expect(matrix.elements.every(Number.isFinite)).toBe(true);if(native)for(const j of[1,2,4,6,8,9])expect(Math.abs(matrix.elements[j])).toBe(0);}
    for(const root of[a,b])root.traverse(o=>{const q=o as InstancedMesh;q.geometry?.dispose();if(q.material){const materials=Array.isArray(q.material)?q.material:[q.material];for(const x of materials)x.dispose();o.userData.nightMaterial?.dispose();}});
  }
});

test("Podewil is seven axes by three storeys on actual principal face 33; no opaque wall curtain is authored",()=>{
  const rows=podewilFacadeRowsV297(),panes=rows.filter(r=>r.role.endsWith("-glazing"));expect(panes).toHaveLength(21);
  expect(new Set(panes.map(r=>r.p[1]))).toEqual(new Set([8.4,13.8,19.2]));
  expect(rows.some(r=>r.role.includes("wall")||r.role.includes("facing")||r.role.includes("skin"))).toBe(false);
  expect(rows.filter(r=>r.role==="podewil-paired-giant-pilaster")).toHaveLength(4);
  expect(rows.every(r=>r.sourceId==="DEBE01YYK00002Vr")).toBe(true);
});

test("default-off source admission and complete replacement precede only exact old fitting indices; inputs and complement stay intact",()=>{
  for(const[key,r]of Object.entries(recipes)){
    const native=key.startsWith("minecraft:"),id=key.slice(key.indexOf(":")+1),raw=rawPacket(r.packetPath),snapshot=JSON.stringify(raw);
    expect(littenStadthausPacketCandidateV297(id,native)).toBe(true);expect(littenStadthausPacketCandidateV297(id+"-foreign",native)).toBe(false);
    expect(finish(prepareLittenStadthausV297(raw,id,native))).toBe(raw);
    const prepared=finish(prepareLittenStadthausV297(raw,id,native,true));expect(prepared).not.toBe(raw);expect(prepared.meshes).toHaveLength(raw.meshes.length+1);expect(prepared.nav).toBe(raw.nav);
    for(const rec of r.records){
      // Copy through Buffer's actual byte range; no shared pool or source mutation.
      const bytes=Buffer.from(raw.meshes[rec.mesh].indices,"base64"),before=new Uint32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),dest=new Uint32Array(before.length+7);dest.set(before,7);
      const publicationCopy={...prepared};const removed=finish(applyLittenStadthausTrianglesV297(publicationCopy,rec.mesh,dest,7));expect(removed).toBe(rec.triangles.length);
      const picked=new Set(rec.triangles);for(let t=0;t<before.length/3;t++)for(let j=0;j<3;j++)expect(dest[7+t*3+j]).toBe(picked.has(t)?before[t*3]:before[t*3+j]);
      const incomplete={...prepared,meshes:prepared.meshes.slice(0,-1)},untouched=before.slice();expect(finish(applyLittenStadthausTrianglesV297(incomplete,rec.mesh,untouched,0))).toBe(0);expect(untouched).toEqual(before);
    }
    expect(JSON.stringify(raw)).toBe(snapshot);expect(finish(prepareLittenStadthausV297(prepared,id,native,false))).toBe(raw);
    const bad=structuredClone(raw);const mesh=bad.meshes[r.records[0].mesh];mesh.positions=(mesh.positions[0]==="A"?"B":"A")+mesh.positions.slice(1);expect(finish(prepareLittenStadthausV297(bad,id,native,true))).toBe(bad);
    expect(finish(prepareLittenStadthausV297(raw,id+"-foreign",native,true))).toBe(raw);
  }
});

test("factory provenance rejects incomplete/copied roots and unpublished failures dispose every allocated material and geometry",()=>{
  const root=createLittenStadthausV297(),copy=new Group();copy.userData={...root.userData};expect(hasCompleteLittenStadthausV297(copy)).toBe(false);
  const mesh=root.children[0]as InstancedMesh;root.remove(mesh);expect(hasCompleteLittenStadthausV297(root)).toBe(false);root.add(mesh);expect(hasCompleteLittenStadthausV297(root)).toBe(true);
  mesh.geometry.dispose();(mesh.material as MeshBasicMaterial).dispose();mesh.userData.nightMaterial.dispose();
  const sphere=InstancedMesh.prototype.computeBoundingSphere,g=BoxGeometry.prototype.dispose,d=MeshBasicMaterial.prototype.dispose,n=MeshStandardMaterial.prototype.dispose;const disposed=[0,0,0];
  try{
    InstancedMesh.prototype.computeBoundingSphere=function(){throw Error("simulated unpublished construction failure")};
    BoxGeometry.prototype.dispose=function(){disposed[0]++;g.call(this)};MeshBasicMaterial.prototype.dispose=function(){disposed[1]++;d.call(this)};MeshStandardMaterial.prototype.dispose=function(){disposed[2]++;n.call(this)};
    expect(()=>createLittenStadthausV297()).toThrow("simulated unpublished construction failure");expect(disposed).toEqual([1,1,1]);
  }finally{InstancedMesh.prototype.computeBoundingSphere=sphere;BoxGeometry.prototype.dispose=g;MeshBasicMaterial.prototype.dispose=d;MeshStandardMaterial.prototype.dispose=n;}
});
