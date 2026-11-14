import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group, InstancedMesh, Matrix4 } from "three";
import city from "../src/data/cityWestCinemasV166Source.json";
import shops from "../src/data/westShopfrontsV254.json";
import { createSavignyGardenV341 } from "../src/SavignyGardenV341";
import { createSchoolsV185 } from "../src/SchoolsV185";
import { prepareBoulevardArchitectureV235 } from "../src/boulevardArchitectureV235";
import { prepareWestShopfrontsV254 } from "../src/westShopfrontsV254";
import { prepareWestShopfrontsV341 } from "../src/westShopfrontsV341";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

function finish<T>(task: Generator<void,T>): T { let step=task.next();while(!step.done)step=task.next();return step.value; }
function all(root: Group): InstancedMesh[] {const found:InstancedMesh[]=[];root.traverse(o=>{if(o instanceof InstancedMesh)found.push(o);});return found;}
function dispose(root: Group): void {root.traverse((o)=>{if(o instanceof InstancedMesh){o.geometry.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial]))if(m&&!Array.isArray(m))m.dispose();}});}

test("actual school factories retain their prior meshes and give both schools complete cardinal native detail",()=>{
  for(const native of [false,true]){
    const root=createSchoolsV185(native), meshes=all(root), additions=meshes.filter(m=>m.userData.westRefinementV341);
    expect(additions.map(m=>m.userData.westRefinementV341).sort()).toEqual(["steglitz","tiergarten"]);
    expect(meshes.filter(m=>!m.userData.westRefinementV341).length).toBeGreaterThan(10);
    expect(additions.find(m=>m.userData.westRefinementV341==="steglitz")!.count).toBe(native?1410:1344);
    expect(additions.find(m=>m.userData.westRefinementV341==="tiergarten")!.count).toBe(native?332:452);
    const matrix=new Matrix4();
    for(const m of additions){
      expect(m.userData.textureFree).toBe(true);expect(m.userData.fullStaticDetailOnTouch).toBe(true);
      expect(m.geometry.getAttribute("uv")).toBeUndefined();expect(m.matrixAutoUpdate).toBe(false);
      for(let i=0;i<m.count;i++){
        m.getMatrixAt(i,matrix);expect(matrix.elements.every(Number.isFinite)).toBe(true);
        if(native)expect([1,2,4,6,8,9].every(k=>Math.abs(matrix.elements[k])<1e-8)).toBe(true);
      }
    }
    dispose(root);
  }
});

test("Savigny greenery rejects moved source paths, uses both actual terrains and remains one batch",()=>{
  const changed=structuredClone(city.publicRealm);changed[0].id="changed";
  expect(createSavignyGardenV341(changed)).toBeNull();
  const drawn=createSavignyGardenV341(city.publicRealm)!,native=createSavignyGardenV341(city.publicRealm,true)!;
  expect(all(drawn)).toHaveLength(1);expect(all(native)).toHaveLength(1);
  expect(all(drawn)[0].count).toBe(735);expect(all(native)[0].count).toBe(735);
  expect(all(drawn)[0].geometry.type).toBe("IcosahedronGeometry");expect(all(native)[0].geometry.type).toBe("BoxGeometry");
  const matrix=new Matrix4();for(let i=0;i<all(native)[0].count;i++){
    all(native)[0].getMatrixAt(i,matrix);expect([1,2,4,6,8,9].every(k=>matrix.elements[k]===0)).toBe(true);
  }
  for(const r of [drawn,native]){expect(all(r)[0].instanceMatrix.array.byteLength+(all(r)[0].instanceColor?.array.byteLength??0)).toBeLessThan(56000);dispose(r);}
});

test("every real Ku'damm and Tauentzien packet retains prior geometry, clear openings and unchanged navigation",()=>{
  let packets=0,drawnFields=0,nativeFields=0,maxVertices=0,maxIndices=0,totalBytes=0;
  for(const key of shops.ids.filter(k=>!k.includes("district188"))){
    const [mode,id]=key.split(":"),native=mode==="minecraft",plan=shops.packets[key as keyof typeof shops.packets];
    const original=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString()) as SurroundingCityChunk;
    const previous=finish(prepareWestShopfrontsV254(finish(prepareBoulevardArchitectureV235(original,id,native)),id,native));
    const result=finish(prepareWestShopfrontsV341(previous,id,native));
    expect(result).not.toBe(previous);expect(result.meshes.length).toBe(previous.meshes.length+1);
    result.meshes.slice(0,-1).forEach((p,i)=>expect(p).toBe(previous.meshes[i]));
    expect(result.nav).toBe(previous.nav);expect(result.lines).toBe(previous.lines);
    const part=result.meshes.at(-1)!,xyz=Buffer.from(part.positions,"base64"),indices=Buffer.from(part.indices,"base64");
    const fields=plan.fields.filter(p=>p[9]!==1&&p[7]>.38);let vertex=0;
    for(const f of fields)for(let i=0;i<24;i++,vertex++){
      const p=[0,1,2].map(axis=>xyz.readUInt16LE((vertex*3+axis)*2)/100),dx=p[0]-f[0],dz=p[2]-f[2];
      expect(Math.abs(dx*f[3]+dz*f[4])).toBeLessThan(f[7]/2);
      expect(Math.abs(p[1]-f[1])).toBeLessThan(f[8]/2);
      expect(dx*f[5]+dz*f[6]).toBeGreaterThan(.08);expect(dx*f[5]+dz*f[6]).toBeLessThan(.145);
    }
    expect(xyz.byteLength/6).toBe(vertex);
    if(native)for(let at=0;at<xyz.length;at+=24)expect([0,1,2].some(axis=>[1,2,3].every(i=>xyz.readUInt16LE(at+axis*2)===xyz.readUInt16LE(at+i*6+axis*2)))).toBe(true);
    for(let i=0;i<indices.length;i+=4)expect(indices.readUInt32LE(i)).toBeLessThan(vertex);
    expect(result.meshes.length).toBeLessThanOrEqual(16);
    maxVertices=Math.max(maxVertices,result.meshes.reduce((n,p)=>n+Buffer.from(p.positions,"base64").length/6,0));
    maxIndices=Math.max(maxIndices,result.meshes.reduce((n,p)=>n+Buffer.from(p.indices,"base64").length/4,0));
    totalBytes+=xyz.byteLength+Buffer.from(part.colors,"base64").length+indices.byteLength;
    expect(finish(prepareWestShopfrontsV341(result,id,native))).toBe(result);
    const drift={...previous,origin:[previous.origin[0]+1,previous.origin[1],previous.origin[2]] as [number,number,number]};
    expect(finish(prepareWestShopfrontsV341(drift,id,native))).toBe(drift);
    const changed=structuredClone(previous),m=changed.meshes[plan.guards[0].mesh];m.colors=(m.colors[0]==="A"?"B":"A")+m.colors.slice(1);
    expect(finish(prepareWestShopfrontsV341(changed,id,native))).toBe(changed);
    const snapshot=JSON.stringify(previous),task=prepareWestShopfrontsV341(previous,id,native);expect(task.next().done).toBe(false);task.return(previous);expect(JSON.stringify(previous)).toBe(snapshot);
    packets++;if(native)nativeFields+=fields.length;else drawnFields+=fields.length;
  }
  expect(packets).toBe(18);expect(maxVertices).toBeLessThan(400000);expect(maxIndices).toBeLessThan(2400000);
  console.log({packets,drawnFields,nativeFields,maxVertices,maxIndices,totalBytes});
});
