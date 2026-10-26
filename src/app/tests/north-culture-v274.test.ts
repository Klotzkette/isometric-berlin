import {describe, expect, test} from "bun:test";
import {InstancedMesh, Vector3, Group} from "three";
import source from "../src/data/northCultureV274Source.json";
import torSource from "../src/data/alexanderNorthV166Source.json";
import {NorthCulturePlanV274, createNorthCultureV274, planHerzJesuV274, planGroberUnfugV274, planSchoenhauserTorV274} from "../src/NorthCultureV274";
import {createSuhrkampPfefferbergV189} from "../src/SuhrkampPfefferbergV189";
import {suhrkampCoreV274} from "../src/SuhrkampV274";
import {HERZ_JESU_V274_ID, HERZ_JESU_V274_SECTIONS, herzJesuV274RoofAt, herzJesuV274Solids} from "../src/herzJesuV274Profile";
import {compilePedestrianObstacles, pedestrianPointIsBlocked, type PedestrianPolygonObstacle} from "../src/pedestrianNavigation";
import {alexanderNorthV166RoofAt} from "../src/alexanderNorthV166Profile";
import type {VisualMode} from "../src/visualMode";

const roles=new Set(HERZ_JESU_V274_SECTIONS.map(q=>q.role));
function inside(x:number,z:number,ring:number[][]):boolean{
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
  }return result;
}
function area(r:number[][]){return Math.abs(r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2)}
function metrics(group:Group|InstancedMesh,native:boolean){
  let calls=0,instances=0,bytes=0;
  group.traverse(o=>{
    if(!(o instanceof InstancedMesh))return;
    calls++;instances+=o.count;
    expect(o.geometry.getAttribute("uv")).toBeUndefined();
    for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
    bytes+=o.geometry.index?.array.byteLength??0;
    bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
    const arrays=[...o.instanceMatrix.array,...o.instanceColor!.array];
    expect(arrays.every(Number.isFinite)).toBe(true);
    if(native)for(let i=0;i<o.count;i++)for(const k of [1,2,4,6,8,9])expect(Math.abs(o.instanceMatrix.array[i*16+k])).toBe(0);
    o.geometry.dispose();o.userData.dayMaterial?.dispose();o.userData.nightMaterial?.dispose();
  });return {calls,instances,bytes};
}
function polygons(index:ReturnType<typeof compilePedestrianObstacles>){return [...new Set([...index.cells.values()].flat())].filter(o=>o.kind==="polygon"&&o.sourceId?.startsWith(HERZ_JESU_V274_ID)) as PedestrianPolygonObstacle[]}

describe("v274 four northern culture sites",()=>{
  test("actual constructors accept photographed COMICS! and retain finite full static detail",()=>{
    for(const native of [false,true]){
      const root=createNorthCultureV274(native);
      expect(root.children.length).toBe(2);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      root.traverse(o=>expect(o.matrixAutoUpdate).toBe(false));
      const north=metrics(root,native),tor=metrics(planSchoenhauserTorV274(native,torSource.nativeRuns).mesh("test"),native),suhrkamp=metrics(createSuhrkampPfefferbergV189(native),native);
      expect(north.calls+tor.calls+suhrkamp.calls).toBe(5);
      expect(north.bytes+tor.bytes+suhrkamp.bytes).toBeLessThan(native?1_200_000:250_000);
      console.log("NorthCultureV274",{native,north,tor,suhrkamp});
    }
    expect(planGroberUnfugV274().items.some(v=>v.role==="lettering")).toBe(true);
  });
  test("local sign strokes are centred and punctuation is geometric",()=>{
    const p=new NorthCulturePlanV274(false);
    p.label({a:[0,0],b:[20,0],normal:[0,1],bottom:0,top:5},"COMICS!",10,2,1,0xffffff);
    const points=p.items.flatMap(v=>[new Vector3(0,-.5,0).applyMatrix4(v.matrix).x,new Vector3(0,.5,0).applyMatrix4(v.matrix).x]);
    expect((Math.min(...points)+Math.max(...points))/2).toBeCloseTo(10,8);
    const last=p.items.slice(-2);expect(last.length).toBe(2);
    expect(last.map(i=>i.matrix.elements[13]).sort()).toEqual([2.04,2.65]);
  });
  test("tower collision solids match every rendered section, independently in both modes",()=>{
    for(const native of [false,true]){
      const rendered=planHerzJesuV274(native).items.filter(v=>roles.has(v.role));
      const solids=herzJesuV274Solids(native);
      const matrixVolume=rendered.reduce((v,r)=>v+Math.abs(r.matrix.determinant()),0);
      const collisionVolume=solids.reduce((v,s)=>v+area(s.ring)*(s.maxY-s.minY),0);
      expect(collisionVolume).toBeCloseTo(matrixVolume,5);
      const inverses=rendered.map(r=>({matrix:r.matrix.clone().invert(),top:r.matrix.elements[13]+r.matrix.elements[5]/2}));
      const [cx,cz]=source.herzJesu.towerCenter;
      // Samples include the projected AABB corners, stepped roof and eaves.
      for(let dx=-7.11;dx<=7;dx+=.47031)for(let dz=-7.08;dz<=7;dz+=.47029){
        const x=cx+dx,z=cz+dz;
        const sampled=rendered.filter(r=>{const v=new Vector3(x,r.matrix.elements[13],z).applyMatrix4(r.matrix.clone().invert());return Math.abs(v.x)<=.5&&Math.abs(v.z)<=.5});
        const top=sampled.length?Math.max(...sampled.map(r=>r.matrix.elements[13]+r.matrix.elements[5]/2)):null;
        const profile=herzJesuV274RoofAt(x,z,native);
        if(top===null)expect(profile).toBeNull();else expect(profile).toBeCloseTo(top,6);
        for(const y of [25.1,28.7,36.5,41.1,44,48.1,50,54,56]){
          const visual=inverses.some(r=>{const v=new Vector3(x,y,z).applyMatrix4(r.matrix);return Math.abs(v.x)<.5&&Math.abs(v.y)<.5&&Math.abs(v.z)<.5});
          const collision=solids.some(s=>y>s.minY&&y<s.maxY&&inside(x,z,s.ring));
          expect(collision).toBe(visual);
        }
      }
    }
    expect(herzJesuV274RoofAt(NaN,0,true)).toBeNull();
  });
  test("real navigation follows the live visual mode and leaves native AABB corners empty",()=>{
    expect(polygons(compilePedestrianObstacles({buildings:[]})).length).toBe(0);
    let mode:VisualMode="day";
    const index=compilePedestrianObstacles({buildings:[]},()=>mode,{northCultureV274:true});
    const actual=polygons(index);
    expect(actual.length).toBe(herzJesuV274Solids(false).length+herzJesuV274Solids(true).length);
    const [cx,cz]=source.herzJesu.towerCenter;
    for(const native of [false,true,false]){
      mode=native?"minecraft":"day";
      expect(pedestrianPointIsBlocked(cx,cz,45,index)).toBe(true);
      expect(pedestrianPointIsBlocked(cx+6,cz+6,45,index)).toBe(false);
      expect(pedestrianPointIsBlocked(cx,cz,herzJesuV274RoofAt(cx,cz,native)!+.05,index)).toBe(false);
      for(const p of actual)expect(p.topAt!(cx,cz)).toBe(p.sourceId!.includes(native?":native:":":drawn:")?p.maxY:Number.NEGATIVE_INFINITY);
    }
  });
  test("all four Tor crown facets are visible outside retained source roofs",()=>{
    expect(source.schoenhauserTorFaces.length).toBe(4);
    for(const f of source.schoenhauserTorFaces){
      const x=(f.a[0]+f.b[0])/2+f.normal[0]*.4,z=(f.a[1]+f.b[1])/2+f.normal[1]*.4;
      expect(alexanderNorthV166RoofAt(x,z)??-Infinity).toBeLessThan(f.top-8.85);
    }
    const p=planSchoenhauserTorV274();
    expect(p.items.every(v=>!v.role.includes("door")&&!v.role.includes("entr"))).toBe(true);
    expect(new Set(p.items.map(v=>v.role))).toEqual(new Set(["built-tor-crown-edge","glazed-crown-transom","crown-sunshade","upper-crown-mullion"]));
  });
  test("native Tor members clear actual retained source cells without removing or rotating them",()=>{
    expect(()=>planSchoenhauserTorV274(true)).toThrow("retained source cells");
    const p=planSchoenhauserTorV274(true,torSource.nativeRuns);
    const cells=torSource.nativeRuns.filter(r=>r[0]>2620&&r[0]<2720&&r[2]>-1120&&r[2]<-1020);
    for(const q of p.items){
      const e=q.matrix.elements;
      const overlap=cells.some(r=>Math.abs(e[12]-r[0])<(e[0]+r[3])/2-.001&&
        Math.abs(e[13]-r[1])<(e[5]+r[4])/2-.001&&Math.abs(e[14]-r[2])<(e[10]+r[5])/2-.001);
      expect(overlap).toBe(false);
      for(const k of [1,2,4,6,8,9])expect(Math.abs(e[k])).toBe(0);
    }
    expect(p.items.length).toBe(2107);
  });
  test("Suhrkamp alters exactly two western glass flanks, rejecting face drift",()=>{
    const matched=[];
    for(const f of source.suhrkampFaces){
      const rows:number[][]=[];
      const accepts=suhrkampCoreV274(f,(...r)=>rows.push(r));
      expect(accepts).toBe(f.normal[0]<-.9);
      if(!accepts){expect(rows.length).toBe(0);continue;}
      matched.push(f);
      const glass=rows.filter(r=>r[5]===0x55767c);
      expect(glass.length).toBe(7);
      const len=Math.hypot(f.b[0]-f.a[0],f.b[1]-f.a[1]);
      expect(glass.every(r=>r[2]>len*.6&&r[0]-r[2]/2>=0&&r[0]+r[2]/2<=len)).toBe(true);
      for(const changed of [{...f,top:f.top+.001},{...f,normal:[-f.normal[0],-f.normal[1]]},{...f,a:[f.a[0]+.001,f.a[1]]}])expect(suhrkampCoreV274(changed,()=>{throw Error("changed face must not emit") })).toBe(false);
    }expect(matched.length).toBe(2);
  });
});
