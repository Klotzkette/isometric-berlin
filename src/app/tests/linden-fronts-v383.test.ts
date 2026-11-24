import { expect, test } from "bun:test";
import { Color, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import scene from "../public/mesh/regierungsviertel/scene.json";
import parkFile from "../public/mesh/regierungsviertel/park-details.json";
import voxelFile from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import { decodeTrees, createParkTreeStand, type ParkDetailsPayload } from "../src/ParkDetails";
import { minecraftVoxelTreeRetained, type VoxelPayload } from "../src/terrainPayload";
import type { TunnelPortalPayload } from "../src/TunnelPortals";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";
import { lindenFrontHostsV383 } from "../src/lindenFrontIndexV383";
import { attachLindenFrontV383 } from "../src/lindenFrontV383";
import * as canopy from "../src/lindenFrontCanopyV383";
import * as before from "../src/MitteCanopyV376";

const tunnel=scene.tiergartentunnel as unknown as TunnelPortalPayload;
const park=parkFile as unknown as ParkDetailsPayload;
const raw=voxelFile as unknown as VoxelPayload;
const street=canopy.earlyCanopiesV376().at(-2)!;
const grove=canopy.earlyCanopiesV376().at(-1)!;

test("243 surveyed avenue trees reuse their old identities on arrival and after the rest of the park loads",()=>{
  expect(street.length).toBe(243);
  expect(grove.length).toBe(71);
  expect(grove.every(t=>t.catalogue==="anlagenbaum" && t.species?.includes("kastanie"))).toBeTrue();
  const original=before.withCanopyParkV376(park);
  const completed=canopy.withCanopyParkV376(park);
  expect(completed.trees.length).toBe(original.trees.length);
  expect(canopy.withCanopyParkV376(completed)).toBe(completed);
  expect(new Set(street.map(t=>t.id)).size).toBe(243);
  const affected=new Set([...street,...grove].map(t=>Number(t.id.slice(5))));
  const diffs=completed.trees.flatMap((v,i)=>v===original.trees[i] ? [] : [i]);
  // Earlier independently fitted Mitte canopies also expand compact records.
  for (const i of diffs) if (!affected.has(i)) expect(completed.trees[i]).toEqual(original.trees[i]);
  for (const t of street) {
    expect(completed.trees[Number(t.id.slice(5))]).toBe(t);
    expect(t.species?.toLowerCase()).toContain("linde");
  }
  for(const t of grove) expect(completed.trees[Number(t.id.slice(5))]).toBe(t);
  const index=Number(street[0].id.slice(5));
  const changed={...park,trees:park.trees.slice()};
  const source=changed.trees[index];
  changed.trees[index]="h" in source ? {...source,i:"replacement-tree"} : {...source,id:"replacement-tree"};
  expect(canopy.withCanopyParkV376(changed).trees[index]).toBe(changed.trees[index]);
  const decoded=decodeTrees(completed.trees,completed.tree_vocabulary);
  expect(new Set(decoded.map(t=>t.id)).size).toBe(decoded.length);
  const early=canopy.createMitteCanopiesV376(tunnel,false);
  expect(early.children.filter(x=>x.name.includes("Alleebäume")).reduce((n,m)=>n+m.userData.treeCount,0)).toBe(243);
});

test("complete native street-tree rows retain all registered stems, crown sizes and six previously shifted centres",()=>{
  const voxels=canopy.withCanopyVoxelsV376(raw);
  let shifted=0;
  for (const t of street) {
    const [cx,cz]=t.nativeTreeBlock!;
    if (Math.floor(t.position[0]/4)!==cx || Math.floor(t.position[2]/4)!==cz) shifted++;
    for(const profile of ["full","mobile"] as const)
      expect(minecraftVoxelTreeRetained(cx,cz,profile,voxels.retainSurveyTree)).toBeTrue();
    const v=voxels.surveyedNativeCrown!(cx,cz)!;
    expect([v.x,v.z,v.height,v.diameter,v.stemRadius]).toEqual(
      [t.position[0],t.position[2],t.height_m,2*t.crown_radius_m,t.trunk_radius_m!]);
  }
  expect(shifted).toBe(6);
  for(const t of grove){
    const [x,z]=t.nativeTreeBlock!;
    expect(voxels.surveyedNativeCrown!(x,z)?.diameter).toBe(2*t.crown_radius_m);
    expect(voxels.retainSurveyTree!(x,z)).toBeTrue();
  }
  const old=before.withCanopyVoxelsV376(raw);
  expect(voxels.tree_rows).toEqual(old.tree_rows);
  const t=street[0], [x,z]=t.nativeTreeBlock!, dz=z-raw.grid.min_z_idx;
  const altered={...raw,tree_rows:raw.tree_rows!.slice()};
  altered.tree_rows[dz]=altered.tree_rows[dz].filter(([xx])=>xx!==x-raw.grid.min_x_idx);
  expect(canopy.withCanopyVoxelsV376(altered).surveyedNativeCrown!(x,z)).toBeUndefined();
});

test("all three vase-shaped linden crown variants fit their measured heights and diameters",()=>{
  const matrix=new Matrix4(),p=new Vector3();
  for (const variant of [0,1,2]) {
    const t={...street[0],variant,position:[1000,0,200] as [number,number,number]};
    const stand=createParkTreeStand([t],tunnel,false);
    let lowX=Infinity,hiX=-Infinity,lowZ=Infinity,hiZ=-Infinity,top=-Infinity;
    for(const obj of stand.children) {
      if (!(obj instanceof InstancedMesh) || !obj.name.includes("vase-shaped")) continue;
      const v=obj.geometry.getAttribute("position");
      for(let i=0;i<obj.count;i++){
        obj.getMatrixAt(i,matrix);
        for(let j=0;j<v.count;j++){
          p.fromBufferAttribute(v,j).applyMatrix4(matrix);
          lowX=Math.min(lowX,p.x);hiX=Math.max(hiX,p.x);lowZ=Math.min(lowZ,p.z);hiZ=Math.max(hiZ,p.z);top=Math.max(top,p.y);
        }
      }
    }
    expect(top).toBeCloseTo(t.height_m,2);
    expect(Math.max(hiX-lowX,hiZ-lowZ)).toBeCloseTo(2*t.crown_radius_m,2);
  }
});

test("both styles install all three photographic frontage groups inside their advertised world-space extents, once",async ()=>{
  for(const native of [false,true]) for(const {id,bounds} of lindenFrontHostsV383) {
    const entry={root:new Group(),origin:[512,-10,0],geometryBytes:0,bufferCount:0} as unknown as SurroundingChunkGeometry;
    const controller=new AbortController();
    await Promise.all([attachLindenFrontV383(entry,id,native,controller.signal),attachLindenFrontV383(entry,id,native,controller.signal)]);
    expect(entry.root.children.length).toBe(1);
    expect(entry.geometryBytes).toBeGreaterThan(3000);
    const mesh=entry.root.getObjectByName("Unter den Linden · fotografisch belegte Straßenfronten") as Mesh;
    const positions=mesh.geometry.getAttribute("position");
    const c=mesh.geometry.getAttribute("color");
    const seen=new Set<number>();
    for(let v=0;v<positions.count;v++){
      const x=mesh.position.x+.01*positions.getX(v),z=mesh.position.z+.01*positions.getZ(v);
      if(x<bounds[0]||x>bounds[2]||z<bounds[1]||z>bounds[3])throw Error("Geometry outside "+id);
      seen.add(Math.round(255*c.getX(v))*65536+Math.round(255*c.getY(v))*256+Math.round(255*c.getZ(v)));
    }
    expect(seen.size).toBeGreaterThan(7);
    expect(mesh.userData.nativeMinecraft).toBe(native);
  }
});

test("drawn and native Linden 21 show the photographed door, stone surround and upper glazed fascia at the public entrance", async () => {
  const wall = new Vector3(1223.959,5.2,261.768);
  const along = new Vector3(15.603,0,-1.303).normalize();
  const outward = new Vector3(along.z,0,-along.x);
  for (const native of [false,true]) {
    const entry = {root:new Group(),origin:[0,0,0],geometryBytes:0,bufferCount:0} as unknown as SurroundingChunkGeometry;
    await attachLindenFrontV383(entry,"lindenfront383-mitte",native,new AbortController().signal);
    entry.root.updateMatrixWorld(true);
    for (const [distance,height,hex] of [
      [7.27,1.79,0x586e7a], [5.07,1.79,0x414549], [4.29,7.40,0x5e768f],
    ]) {
      const origin=wall.clone().addScaledVector(along,distance).addScaledVector(outward,9);
      origin.y += height;
      const hit=new Raycaster(origin,outward.clone().negate(),0,14).intersectObject(entry.root,true)[0];
      expect(hit?.face).toBeDefined();
      const color=(hit.object as Mesh).geometry.getAttribute("color");
      const actual=[color.getX(hit.face!.a),color.getY(hit.face!.a),color.getZ(hit.face!.a)];
      expect(actual).toEqual(new Color(hex).toArray().map(v=>Math.round(v*255)/255));
    }
  }
});
