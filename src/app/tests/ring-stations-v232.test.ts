import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, Texture, Vector3 } from "three";
import { createRingStationsV232, planRingStationsV232 } from "../src/RingStationsV232";
import { createRailStationsV190 } from "../src/RailStationsV190";
import source from "../src/data/ringStationsV232.json";

const protectedNames = ["Wedding","Gesundbrunnen","Ostkreuz","Südkreuz","Westkreuz"];
function dispose(root: ReturnType<typeof createRingStationsV232>) {
  const geometries=new Set<any>(),materials=new Set<any>();
  root.traverse(o=>{if(o instanceof Mesh){geometries.add(o.geometry);for(const m of [o.userData.dayMaterial,o.userData.nightMaterial,...(Array.isArray(o.material)?o.material:[o.material])])if(m)materials.add(m);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
describe("Ring station recognition v232",()=>{
  for(const native of [false,true])test(native?"bounded independently orthogonal native":"full drawn detail and protected hubs",()=>{
    const root=createRingStationsV232(native);
    expect(root.children).toHaveLength(22);
    expect(root.userData.auditedStationCount).toBe(27);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    let count=0,bytes=0;
    root.traverse(o=>{
      expect(o.matrixAutoUpdate).toBe(false);
      if(!(o instanceof InstancedMesh))return;
      expect(protectedNames).not.toContain(o.userData.stationName);
      expect(o.frustumCulled).toBe(true);
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
      count+=o.count;bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;
      for(const v of o.instanceMatrix.array)expect(Number.isFinite(v)).toBe(true);
      if(native)for(let i=0;i<o.count;i++)for(const j of [1,2,4,6,8,9])expect(o.instanceMatrix.array[i*16+j]).toBe(0);
      for(const m of [o.userData.dayMaterial,o.userData.nightMaterial])for(const v of Object.values(m))expect(v instanceof Texture).toBe(false);
      expect(Object.keys(o.userData).sort()).toEqual(["blockNative","dayMaterial","keepInMinecraft","nightMaterial","stationName","textureFree"]);
    });
    expect(count).toBe(native?9631:3259);
    expect(bytes).toBeLessThan(native?750_000:250_000);
    console.log({native,ringInstances:count,ringInstanceBytes:bytes});
    dispose(root);
  });
  for(const native of [false,true])test(`reverse lettering is outside the ACTUAL retained v190 board (${native})`,()=>{
    const old=createRailStationsV190(native),plan=planRingStationsV232(native),m=new Matrix4(),inv=new Matrix4(),p=new Vector3();
    for(const site of source.sites){
      const group=old.children.find(g=>g.userData.stationName===site.name)!;
      const plates:Matrix4[]=[];
      group.traverse(o=>{
        if(!(o instanceof InstancedMesh))return;
        for(let i=0;i<o.count;i++){
          o.getMatrixAt(i,m);
          // Unchanged original name board has a 0.32m cap + .35m margin.
          if(Math.abs(m.elements[5]-.67)<.00001&&Math.abs(m.elements[13]-(site.sign.y+2.66))<.00001)plates.push(m.clone());
        }
      });
      expect(plates.length).toBeGreaterThan(0);
      const letters=plan.filter(b=>b.station===site.name&&b.role==="reverse name lettering");
      expect(letters.length).toBeGreaterThan(0);
      for(const letter of letters){
        for(const plate of plates){
          p.set(letter.matrix[12],letter.matrix[13],letter.matrix[14]).applyMatrix4(inv.copy(plate).invert());
          expect(Math.abs(p.x)<.5&&Math.abs(p.y)<.5&&Math.abs(p.z)<.5).toBe(false);
        }
        const n=[site.sign.dz,-site.sign.dx];
        const projection=(letter.matrix[12]-site.sign.x)*n[0]+(letter.matrix[14]-site.sign.z)*n[1];
        expect(projection).toBeGreaterThan(.09);
      }
    }
    dispose(old);
  });
  test("the four caps remain source-owned and only thirteen open supports are added",()=>{
    const plan=planRingStationsV232(false);
    const posts=plan.filter(b=>b.role==="open canopy support");
    expect(posts).toHaveLength(13);
    expect(new Set(posts.map(p=>p.station))).toEqual(new Set(["Schönhauser Allee","Westhafen"]));
    for(const post of posts){
      const canopy=source.sites.flatMap(s=>s.canopies).find(c=>c.id===post.sourceId)!;
      expect(post.matrix[13]-post.matrix[5]/2).toBeCloseTo(canopy.floor,6);
      expect(post.matrix[13]+post.matrix[5]/2).toBeCloseTo(canopy.top-.16,6);
    }
    expect(plan.some(p=>/surface|platform body|roof body/.test(p.role))).toBe(false);
  });
});
