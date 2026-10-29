import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { InstancedMesh } from "three";
import source from "../src/leipzigerPlatzSource.json";
import { createLeipzigerPerimeterFacades } from "../src/LeipzigerPerimeterFacades";
import { isTorhausPhotoWall, isTrionPhotoWall, LEIPZIGER_PERIMETER_PARTS, LEIPZIGER_PERIMETER_RUNS } from "../src/leipzigerPerimeterProfile";

// These are the actual Float32 buffer receipts from before this photo pass.
// Keeping data in the source file alone would not prove rendered preservation.
const untouched = {
  drawn: {
    northWest:"d3c7fc5337101b50e3499d86112858ed154fc7a414803201cd23e1542097fcee",
    mosse:"f080b307c0e42ae781e6fa529adb280a1ad6fcda130e71ac4fa54cca75899180",
    northEast:"06756dafb52b5cdf40fb1deb6b0bcb2967a8a93f364a24691b9f8952e2f79a9f",
    southMiddleWest:"83b0440b8bcd5a7349a7929adde35a8bc4eb44eba2d825a838752f063ccdadbc",
    southMiddleWestLowerFront:"3656e8e9afbf985b33e3f7397075b5550300b0fccadb8718196a2aa37bd1c4a2",
    southMiddleWestUpperFront:"64105317a31df8e9348445660e1751eadb13d5df0f3ddd1fe271acc98f0a86d3",
    southMiddleEast:"4bc6eb266ddbb6f38b0ddfb04b48f490b9831317b9309e1852635b4998fae592",
    southEast:"ce6c880de5a5ff8d8edc95f0501ba44a3ee7a693fff994d315d911263236ea21",
    eastChamfer:"76ec6f04a9934e8f66bb95fbe91854c8f31014c1c70f6727b2e540cb73d499c2",
    east:"22a2d9a872cb4c36eb41dc095d67f259ccf84338f11315bad4cf814efe026e8f",
  },
  native: {
    northWest:"7fbd76d72acd8b46375c5c2a28a4d05c2a37d923b8533cc28687d30937bb3186",
    mosse:"9e5a9004427771e21506c568bf9ec6ce3c018116b24692ffae65d74f562198d3",
    northEast:"38952efe4d52c7b36f164a051685a8a6033252f1cad2da24c5ee8ba46b88c2d6",
    southMiddleWest:"27ce53f955472b28f9744668811a1cd5f7b64048b73a4b641274bd1e28faf05c",
    southMiddleWestLowerFront:"af8977a7047a8e1711e265ceda43219e05fbe2b5b5a72cc193951906594a0d5f",
    southMiddleWestUpperFront:"d955cb1ae20ac812ce82e55b1979a855d479ba96e457cfc2564853d8197f99d8",
    southMiddleEast:"ca329e73c2df7e757e8c0f487a8c54f0be44365749f594e5f7a880ec8980f66b",
    southEast:"9f132e6473cbc5a600208889e7d4b6c077b41e134654c1ae8d9c17b55fa79c07",
    eastChamfer:"bf66be74d54aeb4d89002bd3aae400508654dd5cc804ef2bf57e3aeda718c4b6",
    east:"bc10191961407b2c95a366f0a90c3380f7d519bd3ea84a4dcd7a35f33651b63e",
  },
};
type PhotoRange={partId:string;wallIndex:number;start:number;count:number;kind:"torhaus"|"stadtpalais"|"trion"};
function digest(mesh:InstancedMesh,indices:number[]):string {
  const hash=createHash("sha256"),matrices=mesh.instanceMatrix.array as Float32Array,colors=mesh.instanceColor!.array as Float32Array;
  for(const i of indices)hash.update(new Uint8Array(matrices.buffer,matrices.byteOffset+i*64,64));
  for(const i of indices)hash.update(new Uint8Array(colors.buffer,colors.byteOffset+i*12,12));
  return hash.digest("hex");
}

describe("Potsdamer Platz owner photos: exact Torhaus and TRION walls",()=>{
  test("complete source bytes and all ten unaffected drawn/native profile buffers remain unchanged",()=>{
    expect(createHash("sha256").update(readFileSync(new URL("../src/leipzigerPlatzSource.json",import.meta.url))).digest("hex")).toBe("a72c7c120a52e2ab64e895a3ad72576a7c0367b9d23bc8bae6be486f1eb22563");
    const before=JSON.stringify(source);
    for(const native of[false,true]){
      const root=createLeipzigerPerimeterFacades(native),mesh=root.children[0] as InstancedMesh;
      const baseline:Record<string,string>=native?untouched.native:untouched.drawn;
      let offset=0;
      for(const [key,n] of Object.entries(root.userData.profileInstances as Record<string,number>)){
        if(baseline[key])expect(digest(mesh,Array.from({length:n},(_,i)=>offset+i))).toBe(baseline[key]);
        if(!native&&key==="southWest"){
          const photoIndices=new Set<number>((root.userData.photoWallInstances as PhotoRange[]).filter(r=>r.kind!=="trion").flatMap(r=>Array.from({length:r.count},(_,i)=>r.start+i)));
          const earlier=Array.from({length:n},(_,i)=>offset+i).filter(i=>!photoIndices.has(i));
          expect(earlier).toHaveLength(1927);
          expect(digest(mesh,earlier)).toBe("c3d8d76e38a0ee4974e71a01a9dcdc9e68f59fa7c24d4467c8b78bd2d3aea83f");
        }
        offset+=n;
      }
      expect(offset).toBe(mesh.count);
    }
    expect(JSON.stringify(source)).toBe(before);
  });

  test("the exact newly visible street planes use retained walls without court, roof or replacement solids",()=>{
    const runs=LEIPZIGER_PERIMETER_RUNS.filter(isTorhausPhotoWall);
    expect(runs).toHaveLength(11);
    expect(LEIPZIGER_PERIMETER_RUNS.filter(isTrionPhotoWall)).toHaveLength(6);
    for(const r of runs){
      const wall=LEIPZIGER_PERIMETER_PARTS.find(p=>p.part.id===r.partId)!.part.surfaces[r.wallIndex];
      expect(wall.kind).toBe("WallSurface");
      expect(r.normal[0]).toBeLessThan(0);
      for(const [x,z] of[r.a,r.b])expect(wall.rings[0].some(p=>p[0]===x&&p[2]===z)).toBeTrue();
      expect(r.top).toBe(Math.max(...wall.rings[0].map(p=>p[1])));
      expect(r.bottom).toBe(Math.min(...wall.rings[0].map(p=>p[1])));
    }
  });

  test("each photo component stays within its source edge and height, with tall base panes and orthogonal native bricks",()=>{
    for(const native of[false,true]){
      const root=createLeipzigerPerimeterFacades(native),mesh=root.children[0] as InstancedMesh,m=mesh.instanceMatrix.array;
      const ranges=root.userData.photoWallInstances as PhotoRange[];
      expect(ranges).toHaveLength(23);
      for(const range of ranges){
        const r=LEIPZIGER_PERIMETER_RUNS.find(r=>r.partId===range.partId&&r.wallIndex===range.wallIndex)!;
        const tx=(r.b[0]-r.a[0])/r.length,tz=(r.b[1]-r.a[1])/r.length;
        expect(range.count).toBeGreaterThan(0);
        let tallBase=false;
        for(let i=range.start;i<range.start+range.count;i++){
          const o=i*16,halfY=m[o+5]/2,y=m[o+13],x=m[o+12],z=m[o+14];
          expect(y-halfY).toBeGreaterThanOrEqual(r.bottom+.1-1e-4);
          expect(y+halfY).toBeLessThanOrEqual(r.top-.17+1e-4);
          if(r.partId==="DEBE3DsjTZxEWmPH"&&r.wallIndex===6){
            const shoulder=LEIPZIGER_PERIMETER_PARTS.find(p=>p.part.id==="DEBE3DjIomtjGFLa")!.part.top_y_m;
            expect(y-halfY).toBeGreaterThanOrEqual(shoulder+.1-1e-4);
          }
          if(native)for(const index of[1,2,3,4,6,7,8,9,11])expect(m[o+index]).toBe(0);
          // Project each actual transformed box corner, not only its centre.
          const u=(x-r.a[0])*tx+(z-r.a[1])*tz;
          const halfProjection=(Math.abs(m[o]*tx+m[o+2]*tz)+Math.abs(m[o+8]*tx+m[o+10]*tz))/2;
          expect(u-halfProjection).toBeGreaterThanOrEqual(.015-1e-4);
          expect(u+halfProjection).toBeLessThanOrEqual(r.length-.015+1e-4);
          if(y<r.ground+4&&halfY*2>4)tallBase=true;
        }
        if(r.bottom===r.ground)expect(tallBase).toBeTrue();
      }
      // Every existing and new component of the two changed native profiles
      // is independently orthogonal; unrelated native bytes are receipted above.
      if(native){let offset=0;for(const [key,n]of Object.entries(root.userData.profileInstances as Record<string,number>)){if(key==="west"||key==="southWest")for(let i=offset;i<offset+n;i++)for(const k of[1,2,3,4,6,7,8,9,11])expect(m[i*16+k]).toBe(0);offset+=n;}}
      expect(root.children).toHaveLength(1);
      expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(950_000);
      expect(mesh.count).toBeLessThan(12_500);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.matrixAutoUpdate).toBeFalse();
      expect(root.userData.photoDimensions).toContain("display estimates");
    }
  });

  test("native pier coalescing preserves the actual occupied coloured box union",()=>{
    const compact=createLeipzigerPerimeterFacades(true),original=createLeipzigerPerimeterFacades(true,false);
    expect(compact.userData.nativeColumnMerges).toBeGreaterThan(0);
    expect(original.userData.nativeColumnMerges).toBe(0);
    function occupied(root:typeof compact):Map<string,[number,number][]> {
      const mesh=root.children[0] as InstancedMesh,m=mesh.instanceMatrix.array,c=mesh.instanceColor!.array;
      const groups=new Map<string,[number,number][]>();let offset=0;
      for(const [profile,n]of Object.entries(root.userData.profileInstances as Record<string,number>)){
        if(profile==="west"||profile==="southWest")for(let i=offset;i<offset+n;i++){
          const o=i*16,key=[profile,m[o],m[o+10],m[o+12],m[o+14],c[i*3],c[i*3+1],c[i*3+2]].join(":");
          const intervals=groups.get(key)??[];intervals.push([m[o+13]-m[o+5]/2,m[o+13]+m[o+5]/2]);groups.set(key,intervals);
        }
        offset+=n;
      }
      for(const [key,intervals]of groups){
        intervals.sort((a,b)=>a[0]-b[0]);const union:[number,number][]=[];
        for(const range of intervals){const previous=union.at(-1);if(previous&&range[0]<=previous[1]+1e-5)previous[1]=Math.max(previous[1],range[1]);else union.push([...range]);}
        groups.set(key,union);
      }
      return groups;
    }
    const a=occupied(compact),b=occupied(original);
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
    for(const [key,intervals]of a){const before=b.get(key)!;expect(intervals).toHaveLength(before.length);for(let i=0;i<intervals.length;i++){expect(intervals[i][0]).toBeCloseTo(before[i][0],4);expect(intervals[i][1]).toBeCloseTo(before[i][1],4);}}
    expect((compact.children[0]as InstancedMesh).count).toBe((original.children[0]as InstancedMesh).count-compact.userData.nativeColumnMerges);
  });
});
