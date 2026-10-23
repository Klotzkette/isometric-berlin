import { describe, expect, test } from "bun:test";
import { Group, InstancedMesh, Mesh } from "three";
import { createEmbassyGateV264, EMBASSY_GATE_V264_PROFILE, embassyFlagColorAtV264 } from "../src/EmbassyGateV264";
import { createCentralCivicDetails } from "../src/CentralCivicDetails";
import { createPariserPlatzArchitecture } from "../src/PariserPlatzArchitecture";
import { createMinecraftPariserPlatzArchitecture } from "../src/MinecraftPariserPlatzArchitecture";
import { createMinecraftUnterDenLindenDetails } from "../src/MinecraftUnterDenLindenDetails";

function vertexBag(root: Group): Map<string, number> {
  const bag = new Map<string, number>();
  root.traverse(o => { if (!(o instanceof Mesh)) return;
    const p = o.geometry.getAttribute("position"), c = o.geometry.getAttribute("color");
    for (let i=0;i<p.count;i++) {
      const key = [p.getX(i),p.getY(i),p.getZ(i),c?.getX(i),c?.getY(i),c?.getZ(i)].join(",");
      bag.set(key,(bag.get(key)??0)+1);
    }
  }); return bag;
}
function removedVertices(original: Group, guarded: Group): number[][] {
  const before=vertexBag(original),after=vertexBag(guarded),removed:number[][]=[];
  for (const [key,count] of after) expect(before.get(key)).toBeGreaterThanOrEqual(count);
  for (const [key,count] of before) if (count>(after.get(key)??0)) removed.push(key.split(",").slice(0,3).map(Number));
  return removed;
}
function instanceBag(root:Group):Set<string> {
  const result=new Set<string>(); root.traverse(o=>{if(o instanceof InstancedMesh) for(let i=0;i<o.count;i++) result.add(Array.from(o.instanceMatrix.array.slice(i*16,i*16+16)).join(",")+"/"+Array.from(o.instanceColor!.array.slice(i*3,i*3+3)).join(","));}); return result;
}
describe("three source-bound gate embassies v264",()=>{
  test("complete bounded static drawn and orthogonal native variants",()=>{
    for(const native of [false,true]) {
      const root=createEmbassyGateV264(native); let bytes=0,vertices=0,draws=0;
      root.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false); if(!(o instanceof Mesh))return;
        draws++; expect(o.geometry.getAttribute("uv")).toBeUndefined();
        for(const a of Object.values(o.geometry.attributes)){bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBe(true);}
        bytes+=o.geometry.index?.array.byteLength??0;
        if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;vertices+=o.count*o.geometry.getAttribute("position").count;
          if(native)for(let i=0;i<o.count;i++)for(const j of [1,2,4,6,8,9])expect(o.instanceMatrix.array[i*16+j]).toBe(0);
        }else vertices+=o.geometry.getAttribute("position").count;
      });
      expect(draws).toBe(native?1:2); expect(bytes).toBe(native?275236:236244); expect(vertices).toBe(native?86712:20400);
      expect(bytes).toBeLessThan(EMBASSY_GATE_V264_PROFILE.budgetBytes);expect(root.userData.flagCount).toBe(4);expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    }
  });
  test("flags carry Union cross/saltires, fifty stars, thirteen stripes and European circle",()=>{
    const C=embassyFlagColorAtV264;
    expect(C("uk",.5,.5)).toBe(0xb62837); expect(C("uk",.1,.3)).toBe(0x193d76); expect(C("uk",.15,.15)).not.toBe(0x193d76);
    for(const [u,v] of [[.13,.17],[.85,.79],[.25,.82],[.73,.15]])expect(C("uk",u,v)).toBe(C("uk",1-u,1-v));
    let stars=0;for(let row=0;row<9;row++)for(let col=0;col<(row%2?5:6);col++){expect(C("us",(col+(row%2?1:.5))*.4/6,(row+.5)*(7/13)/9)).toBe(0xf5f2e7);stars++;}expect(stars).toBe(50);
    for(let i=0;i<13;i++)expect(C("us",.8,(i+.5)/13)).toBe(i%2?0xf5f2e7:0xb62837);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;expect(C("eu",.5+Math.sin(a)*.2,.5+Math.cos(a)*.3)).toBe(0xe6c653);}
    expect([.1,.5,.9].map(u=>C("fr",u,.5))).toEqual([0x193d76,0xf5f2e7,0xb62837]);
  });
  test("French optout removes only the old flags and preserves every facade vertex",()=>{
    const removed=removedVertices(createPariserPlatzArchitecture(),createPariserPlatzArchitecture({includeLegacyFrenchFlags:false}));
    expect(removed.length).toBeGreaterThan(10);
    for(const [x,y,z]of removed){expect(x).toBeGreaterThan(510);expect(x).toBeLessThan(523);expect(y).toBeGreaterThan(8.6);expect(y).toBeLessThan(12.1);expect(z).toBeGreaterThan(231);expect(z).toBeLessThan(234);}
  });
  test("British optout removes only the receipted inaccurate collage and roof flag",()=>{
    const removed=removedVertices(createCentralCivicDetails([]),createCentralCivicDetails([],"full",{includeLegacyBritishCollage:false}));
    expect(removed.length).toBeGreaterThan(10);
    for(const [x,y,z]of removed){expect(x).toBeGreaterThan(591);expect(x).toBeLessThan(606);expect(y).toBeGreaterThan(10);expect(y).toBeLessThan(37);expect(z).toBeGreaterThan(362);expect(z).toBeLessThan(383);}
  });
  test("native guard removes only three British collage parts and seven French flag blocks",()=>{
    for(const [before,after,count] of [
      [createMinecraftUnterDenLindenDetails(),createMinecraftUnterDenLindenDetails({includeLegacyBritishCollage:false}),3],
      [createMinecraftPariserPlatzArchitecture(),createMinecraftPariserPlatzArchitecture({includeLegacyFrenchFlags:false}),7],
    ] as const){const a=instanceBag(before),b=instanceBag(after);expect(a.size-b.size).toBe(count);for(const row of b)expect(a.has(row)).toBe(true);}
  });
});
