import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, Vector3 } from "three";
import source from "../src/leipzigerPlatzSource.json";
import { createLeipzigerPerimeterFacades } from "../src/LeipzigerPerimeterFacades";
import { LEIPZIGER_PERIMETER_KEYS, LEIPZIGER_PERIMETER_PARTS, LEIPZIGER_PERIMETER_RUNS, perimeterPoint } from "../src/leipzigerPerimeterProfile";

describe("Leipziger Platz perimeter source-bound relief",()=>{
  test("all twelve perimeter source profiles have exact wall anchors, with no guessed courtyard or canopy infill",()=>{
    expect(LEIPZIGER_PERIMETER_PARTS.length).toBe(64);
    expect(new Set(LEIPZIGER_PERIMETER_RUNS.map(r=>r.key))).toEqual(new Set(LEIPZIGER_PERIMETER_KEYS));
    expect(LEIPZIGER_PERIMETER_RUNS.some(r=>r.partId==="DEBE3DP5ii5cXk3Q")).toBeFalse();
    for(const r of LEIPZIGER_PERIMETER_RUNS){
      const p=LEIPZIGER_PERIMETER_PARTS.find(p=>p.part.id===r.partId)!;expect(p.key).toBe(r.key);
      const wall=p.part.surfaces[r.wallIndex];expect(wall.kind).toBe("WallSurface");
      for(const endpoint of[r.a,r.b])expect(wall.rings[0].some(v=>Math.hypot(v[0]-endpoint[0],v[2]-endpoint[1])<.001)).toBeTrue();
      expect(r.length).toBeGreaterThan(1);expect(r.top).toBeGreaterThan(r.bottom);
      expect(Math.hypot(...r.normal)).toBeCloseTo(1,7);
      const actual=perimeterPoint(r,0,0);expect(actual).toEqual(r.a);
    }
  });
  test("one texture-free static batch preserves all facade profiles within bounded memory",()=>{
    const before=JSON.stringify(source),a=createLeipzigerPerimeterFacades(),b=createLeipzigerPerimeterFacades(true);
    expect(JSON.stringify(source)).toBe(before);
    for(const model of[a,b]){
      expect(model.children).toHaveLength(1);expect(model.userData.facadeOnly).toBeTrue();
      expect(model.userData.noHiddenSolidInfill).toBeTrue();expect(model.userData.sourcePartIds).toHaveLength(64);
      for(const key of LEIPZIGER_PERIMETER_KEYS)expect(model.userData.profileInstances[key]).toBeGreaterThan(100);
      const mesh=model.children[0] as InstancedMesh;expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.geometry.type).toBe("BoxGeometry");expect(mesh.count).toBeGreaterThan(7000);expect(mesh.count).toBeLessThan(12000);
      expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(950_000);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();expect(mesh.matrixAutoUpdate).toBeFalse();
      for(const v of mesh.instanceMatrix.array)expect(Number.isFinite(v)).toBeTrue();
      model.traverse(o=>{if(o instanceof Mesh)expect((o.material as {map?:unknown}).map).toBeFalsy();});
      const size=new Box3().setFromObject(model).getSize(new Vector3());expect(size.x).toBeLessThan(200);expect(size.z).toBeLessThan(250);expect(size.y).toBeLessThan(50);
    }
    expect(a.userData.blockNative).toBeFalse();expect(b.userData.blockNative).toBeTrue();expect((a.children[0] as InstancedMesh).count).toBe((b.children[0] as InstancedMesh).count);
  });
});
