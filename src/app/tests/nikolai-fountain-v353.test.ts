import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { DoubleSide, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Raycaster, Vector3 } from "three";
import {
  createNikolaiFountainV353, NIKOLAI_FOUNTAIN_V353 as site,
  nikolaiFountainGeometryV353, type NikolaiFountainSupportV353,
} from "../src/NikolaiFountainV353";
import { createPublicAmenitiesV332 } from "../src/PublicAmenitiesV332";
import { NAMED_GRAVE_SITES_V347, WALL_MARKER_SITES_V352 } from "../src/NamedGravesV347";
import { buildSurroundingCityChunk, surroundingPolygonContains, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { terrainGroundAt } from "../src/weinbergTerrainV176";
import { optionsV342 } from "./helpers/neukoellnPredecessorV342";
import amenities from "../src/data/publicAmenitiesV332.json";

// Actual browser support capture from candidate 7f24d139, not raw nav.groundY:
// every sample has host=true, water=false and blocked=false. R is the existing
// 9 cm path finish, '.' is the underlying supported plaza floor.
const capturedDrawnFinish=[".RRRRR...",".RRRRR...","..RRRRR..","..RRRRR..","..RRRRRR.","...RRRRR.","...RRRRR.","....RRRRR","....RRRRR"];

const support = (y=3):NikolaiFountainSupportV353 => ({
  ground:()=>y, water:()=>false, blocked:()=>false,
  hasHost:(id,sha)=>id===site.host && [site.drawnSha256,site.nativeSha256].includes(sha),
});
const setup = () => {
  const layer=createNikolaiFountainV353();
  const owner=new Group();owner.add(layer.root);
  return {layer,owner};
};

describe("V353 Wappenbrunnen has one exact public inventory owner",()=>{
  test("official identity, position and documented dimensions are literal, with no overlapping live memorial disk",()=>{
    const rows=Object.values(amenities.cells).flat().filter(row=>row[0]===site.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].slice(3,6)).toEqual([site.inventoryX,site.inventoryZ,""]);
    expect([site.radius*2,site.height,site.basinHeight]).toEqual([4,6,1.7]);
    for(const memorial of [...NAMED_GRAVE_SITES_V347,...WALL_MARKER_SITES_V352])
      expect(Math.hypot(memorial.anchor[0]-site.x,memorial.anchor[1]-site.z)).toBeGreaterThan(360);
  });
  for(const native of [false,true]) {
    test(`${native?"Native":"Drawn"} geometry is finite, textured by no images, non-degenerate and has an open canopy`,()=>{
      const {geometry}=nikolaiFountainGeometryV353(native);
      const p=geometry.getAttribute("position"),normal=geometry.getAttribute("normal"),ix=geometry.index!;
      expect(p.count).toBeLessThan(65000);
      expect(ix.count).toBeLessThan(100000);
      expect(geometry.getAttribute("uv")).toBeUndefined();
      expect(geometry.boundingBox!.min.y).toBe(0);
      expect(geometry.boundingBox!.max.y).toBeCloseTo(6,1);
      expect(Math.max(Math.abs(geometry.boundingBox!.min.x),geometry.boundingBox!.max.x)).toBeLessThanOrEqual(2.001);
      expect(Math.max(Math.abs(geometry.boundingBox!.min.z),geometry.boundingBox!.max.z)).toBeLessThanOrEqual(2.001);
      if(!native) {
        // Correct exterior-facing normals on the first step and its top.
        expect(normal.getX(0)).toBeGreaterThan(.8);
        expect(normal.getY(4)).toBeGreaterThan(.99);
      }
      for(let i=0;i<ix.count;i+=3) {
        const vertices=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,ix.getX(i+j)));
        const area=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).length()/2;
        expect(area).toBeGreaterThan(1e-10);
        if(native)expect(["x","y","z"].some(axis=>vertices.every(v=>v[axis as "x"]===vertices[0][axis as "x"]))).toBeTrue();
      }
      // Actual projected occlusion, not summed surface area (Native boxes have
      // internal faces): a solid canopy would cover most of this square.
      const material=new MeshStandardMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material);
      mesh.updateMatrixWorld();let covered=0;
      for(let z=-1.5;z<=1.5;z+=.15)for(let x=-1.5;x<=1.5;x+=.15) {
        const ray=new Raycaster(new Vector3(x,6.1,z),new Vector3(0,-1,0),0,1.99);
        if(ray.intersectObject(mesh,false).length)covered++;
      }
      expect(covered).toBeLessThan(210);
      material.dispose();
      for(const v of p.array)expect(Number.isFinite(v)).toBeTrue();
      for(const v of normal.array)expect(Number.isFinite(v)).toBeTrue();
      geometry.dispose();
    });
    test(`${native?"Native":"Drawn"} actual pinned packet supports every base sample, clear of buildings/water`,async()=>{
      const file=new URL(`../public/mesh/surrounding-berlin-v159/4_0.${native?"minecraft":"drawn"}.json.gz`,import.meta.url);
      const bytes=Buffer.from(await Bun.file(file).arrayBuffer());
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(native?site.nativeSha256:site.drawnSha256);
      const packet=JSON.parse(gunzipSync(bytes).toString()) as SurroundingCityChunk;
      const build=buildSurroundingCityChunk(packet,"4_0",native,false,await optionsV342("4_0",native));
      let step=build.next();while(!step.done)step=build.next();
      const decoded=step.value;
      expect(decoded.root.userData.sourceKinds).toContain("nikolai-quarter-v353");
      expect(decoded.root.userData.sourceKinds).toContain("nikolaikirche-v353");
      const local=(x:number,z:number)=>[x-decoded.origin[0],z-decoded.origin[2]];
      const actual:NikolaiFountainSupportV353={...support(),
        // Match the real resident-ground path, including its 9 cm road finish.
        ground:(x,z)=>{const [a,b]=local(x,z);return decoded.nav.ground.some(p=>surroundingPolygonContains(p,a,b))?terrainGroundAt(x,z,decoded.nav.groundY,native)+(decoded.nav.roads?.some(p=>surroundingPolygonContains(p,a,b))?.09:0):null;},
        water:(x,z)=>{const [a,b]=local(x,z);return decoded.nav.water.some(p=>surroundingPolygonContains(p,a,b));},
        blocked:(x,y,z)=>{const [a,b]=local(x,z);return decoded.nav.buildings.some(p=>p.minHeight<=1.7&&surroundingPolygonContains(p,a,b));},
      };
      const sampled=[];
      for(let j=-4;j<=4;j++)for(let i=-4;i<=4;i++) {
        const y=actual.ground(site.x+i*.5,site.z+j*.5);
        sampled.push(y);
        if(!native)expect(actual.ground(site.inventoryX+i*.5,site.inventoryZ+j*.5)).toBe(capturedDrawnFinish[j+4][i+4]==="R"?3.09:3);
      }
      expect(sampled.every(y=>y===3||y===3.09)).toBeTrue();
      expect(Math.min(...sampled.map(Number))).toBe(3);
      const {layer}=setup();
      expect(layer.refresh(site.x,site.z,native,actual)).toBeTrue();
      expect(layer.root.children).toHaveLength(1);
      expect(layer.root.children[0].position.y).toBe(3);
      layer.dispose();
      decoded.root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    });
    test(`${native?"Native":"Drawn"} repeated refresh retains one mesh and exact terrain height; leaving disposes once`,()=>{
      const {layer}=setup();const y=12.345;
      expect(layer.refresh(site.x,site.z,native,support(y))).toBeTrue();
      const mesh=layer.root.children[0] as Mesh;
      expect(mesh.position.y+mesh.geometry.boundingBox!.min.y).toBe(y);
      expect(layer.solidAt(site.x,y+.6,site.z,0,native)).toBeTrue();
      expect(layer.solidAt(site.x+2.1,y+.6,site.z,0,native)).toBeFalse();
      expect(layer.solidAt(site.x,y+.6,site.z,0,!native)).toBeFalse();
      expect(layer.refresh(site.x,site.z,native,{...support(y),blocked:(x,y,z)=>layer.solidAt(x,y+.5,z,0,native)})).toBeFalse();
      expect(layer.root.children[0]).toBe(mesh);
      let geometries=0,materials=0;
      mesh.geometry.addEventListener("dispose",()=>geometries++);
      (mesh.material as MeshStandardMaterial).addEventListener("dispose",()=>materials++);
      expect(layer.refresh(site.x+181,site.z,native,support(y))).toBeTrue();
      expect([geometries,materials]).toEqual([1,1]);
      expect(layer.root.children).toHaveLength(0);
      layer.dispose();expect([geometries,materials]).toEqual([1,1]);
    });
  }
  test("absent, mismatched, wet, blocked and discontinuous host terrain fails closed and releases",()=>{
    for(const native of [false,true])for(const bad of [
      {...support(),hasHost:()=>false},
      {...support(),hasHost:(_id:string,sha:string)=>sha===(native?site.drawnSha256:site.nativeSha256)},
      {...support(),ground:()=>null},{...support(),ground:()=>NaN},
      {...support(),water:()=>true},{...support(),blocked:()=>true},
      {...support(),ground:(x:number)=>x<site.x-1.5?null:3},
      {...support(),ground:(x:number)=>x<site.x-1.5?3.2:3},
      {...support(),ground:(x:number)=>x<site.x-1.5?3.1001:3},
    ]) {
      const {layer}=setup();
      expect(layer.refresh(site.x,site.z,native,bad)).toBeFalse();
      expect(layer.root.children).toHaveLength(0);
      layer.refresh(site.x,site.z,native,support());
      expect(layer.refresh(site.x,site.z,native,bad)).toBeTrue();
      expect(layer.root.children).toHaveLength(0);layer.dispose();
    }
  });
  test("family switch, owner hiding and legacy high-altitude release remain connected",()=>{
    const layer=createPublicAmenitiesV332(),scene=new Group();scene.add(layer.root);
    const camera=new PerspectiveCamera();camera.position.set(site.x-13,9,site.z+6);camera.lookAt(site.x,6,site.z);
    layer.refresh(1000,camera,site.x,site.z,false,false,"de",0,support());
    let model=layer.root.getObjectByName("Wappenbrunnen: sandstone basin, bear and open iron canopy") as Mesh;
    expect(model).toBeDefined();
    let released=0;model.geometry.addEventListener("dispose",()=>released++);
    // Host loss must be processed despite identical focus/revision early-return.
    expect(layer.refresh(1300,camera,site.x,site.z,false,false,"de",0,{...support(),hasHost:()=>false})).toBeTrue();
    expect(released).toBe(1);
    layer.refresh(1600,camera,site.x,site.z,true,false,"de",0,support());
    model=layer.root.getObjectByName("Wappenbrunnen: sandstone basin, bear and open iron canopy") as Mesh;
    expect(model.userData.nativeMinecraft).toBeTrue();
    expect(layer.namedGravesSolidAt(site.x,3.6,site.z,0,true)).toBeTrue();
    layer.root.visible=false;expect(layer.namedGravesSolidAt(site.x,3.6,site.z,0,true)).toBeFalse();
    layer.root.visible=true;expect(layer.releaseNamedGraves()).toBeTrue();
    expect(layer.namedGravesSolidAt(site.x,3.6,site.z,0,true)).toBeFalse();
    expect(layer.releaseNamedGraves()).toBeFalse();layer.dispose();
  });
});
