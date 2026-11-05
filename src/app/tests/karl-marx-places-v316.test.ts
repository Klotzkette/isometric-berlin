import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import { createKarlMarxPlacesV316, karlMarxPlacesSolidAtV316 } from "../src/KarlMarxPlacesV316";
import { createEastSquaresV163, createMinecraftEastSquaresV163 } from "../src/EastSquaresV163";

function instanceCount(root: ReturnType<typeof createKarlMarxPlacesV316>): number {
  let count=0;
  root.traverse(object=>{if(object instanceof InstancedMesh)count+=object.count;});
  return count;
}

describe("Karl-Marx-Allee places v316",()=>{
  test("each independent family exposes the photographed display and finite garden fittings",()=>{
    for(const native of [false,true]) {
      const root=createKarlMarxPlacesV316(native);
      expect(root.children).toHaveLength(3);
      const museum=root.getObjectByName("Computerspielemuseum entrance")!;
      expect(museum.userData.roleCounts["raised museum wordmark"]).toBe(2);
      expect(museum.userData.roleCounts["pixel game display"]).toBe(1);
      const garden=root.getObjectByName("James June summer garden")!;
      expect(garden.userData.roleCounts["wood and metal seating group"]).toBe(9);
      expect(instanceCount(root)).toBeLessThan(6000);
      if(native)root.traverse(object=>{
        if(!(object instanceof InstancedMesh))return;
        const matrix=new Matrix4();
        for(let i=0;i<object.count;i++) {
          object.getMatrixAt(i,matrix);
          if([1,2,4,6,8,9].some(index=>matrix.elements[index]!==0))throw new Error("A native fitting has an oblique matrix");
        }
      });
      root.traverse(object=>{
        const material=(object as InstancedMesh).material;
        if(material&&!Array.isArray(material))expect((material as unknown as {map:unknown}).map).toBeNull();
      });
    }
  });

  test("the display is exposed above the source portal in both independent families",()=>{
    for(const native of [false,true]) {
      const root=createKarlMarxPlacesV316(native);root.updateMatrixWorld(true);
      const ray=new Raycaster(new Vector3(4800,9.73,238.457),new Vector3(-1,0,0));
      const hits=ray.intersectObject(root,true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.x).toBeGreaterThan(4793);
      expect(hits[0].point.x).toBeLessThan(4794.5);
    }
  });

  test("raised letters stay close to the adjacent measured wall rather than the projecting portal plane",()=>{
    const root=createKarlMarxPlacesV316(); root.updateMatrixWorld(true);
    const mesh=root.getObjectByName("Computerspielemuseum entrance")!.children[0] as InstancedMesh;
    const target=new Matrix4();
    for(let i=0;i<150;i++) {
      mesh.getMatrixAt(i,target);
      if(target.elements[14]>243&&target.elements[14]<247&&target.elements[13]>8.6)break;
    }
    const position=new Vector3().setFromMatrixPosition(target);
    const ray=new Raycaster(position.clone().add(new Vector3(3,0,0)),new Vector3(-1,0,0));
    const hit=ray.intersectObject(root.getObjectByName("Computerspielemuseum entrance")!,true)[0];
    expect(hit).toBeDefined();
    const wallX=4790.226+(4788.994-4790.226)*(position.z-240.937)/(247.475-240.937);
    expect(hit.point.x-wallX).toBeGreaterThan(0.15);
    expect(hit.point.x-wallX).toBeLessThan(0.40);
  });

  test("garden collision follows tabletop solids while leaving the approach open",()=>{
    for(const native of [false,true]) {
      createKarlMarxPlacesV316(native);
      expect(karlMarxPlacesSolidAtV316(4743.92,3.3,243.49,0.1,native)).toBeTrue();
      expect(karlMarxPlacesSolidAtV316(4770,4,245,0.3,native)).toBeFalse();
      expect(karlMarxPlacesSolidAtV316(4743.92,6,243.49,0.1,native)).toBeFalse();
    }
  });

  test("all previous fountain families and their complete ring geometry remain",()=>{
    for(const native of [false,true]) {
      const previous=native?createMinecraftEastSquaresV163():createEastSquaresV163();
      const before=instanceCount(previous);
      const extra=createKarlMarxPlacesV316(native);
      expect(instanceCount(previous)).toBe(before);
      expect(previous.children).toHaveLength(3);
      expect(extra.getObjectByName("Strausberger ring structural detail")!.userData.roleCounts["polygonal water supply pipe"]).toBe(3);
    }
  });
});
