import { expect,test } from "bun:test";
import { Box3, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from "three";
import manifest from "../public/mesh/surrounding-berlin-v159/manifest.json";
import { createTransportAirportsV378,TRANSPORT_AIRPORT_TILES_V378 } from "../src/transportV378Airports";

test("every airport object belongs to one real packet in each view, full artistic detail is bounded",()=>{
  const descriptors=new Set(manifest.chunks.map(q=>q.id));
  expect(createTransportAirportsV378("0_0")).toBeUndefined();
  for(const native of [false,true]){
    const stands=new Set<number>(),heads=new Set<number>();
    let marks=0,museum=0,beacons=0,meshes=0,vertices=0,bytes=0,largest=0;
    for(const tile of TRANSPORT_AIRPORT_TILES_V378){
      expect(descriptors.has(tile)).toBe(true);
      const root=createTransportAirportsV378(tile,native)!;
      const bounds=new Box3().setFromObject(root);
      expect(bounds.isEmpty()).toBe(false);
      expect(bounds.max.x-bounds.min.x).toBeLessThan(550);
      expect(bounds.max.z-bounds.min.z).toBeLessThan(550);
      for(const id of root.userData.civilianStandsV378) {expect(stands.has(id)).toBe(false);stands.add(id);}
      for(const id of root.userData.gateHeadsV378)heads.add(id);
      museum+=root.userData.museumExhibitsV378;
      marks+=root.userData.disusedRunwayMarksV378??0;
      if(root.userData.updateTransportAirportsV378)beacons++;
      let tileBytes=0;
      root.traverse(object=>{
        if(!(object instanceof Mesh))return;
        meshes++;vertices+=object.geometry.getAttribute("position").count;
        for(const attr of Object.values(object.geometry.attributes))tileBytes+=attr.array.byteLength;
        tileBytes+=object.geometry.index?.array.byteLength??0;
        expect(object.userData.textureFree).toBe(true);
        if(native){
          const n=object.geometry.getAttribute("normal");
          for(let i=0;i<n.count;i++)if(Math.abs(n.getX(i))+Math.abs(n.getY(i))+Math.abs(n.getZ(i))>1.001)
            throw Error("Non-cardinal native surface in "+tile);
        }
        object.geometry.dispose();object.material.dispose();
        if(object.userData.nightMaterial!==object.material)object.userData.nightMaterial.dispose();
      });
      largest=Math.max(largest,tileBytes);bytes+=tileBytes;
    }
    expect([stands.size,heads.size,museum,marks,beacons]).toEqual([8,8,5,20,1]);
    expect(meshes).toBeLessThan(18);
    expect(vertices).toBeLessThan(native?60000:16000);
    console.log({native,meshes,vertices,bytes,largest});
  }
});

test("the decorative BER lamp changes only on screen and respects reduced motion",()=>{
  const root=createTransportAirportsV378("ber236-16_34")!,lamp=root.getObjectByName("BER · dekoratives Towerlicht") as Mesh;
  const camera=new PerspectiveCamera(45,1,.1,5000),point=lamp.getWorldPosition(new Vector3());
  camera.position.copy(point).add(new Vector3(0,50,100));camera.lookAt(point);camera.updateMatrixWorld();
  const update=root.userData.updateTransportAirportsV378;
  const color=()=> (lamp.material as MeshBasicMaterial).color.getHex();
  const old=color();
  expect(update(1800,camera,false)).toBe(true);expect(color()).not.toBe(old);
  expect(update(1810,camera,false)).toBe(false);
  expect(update(1810,camera,true)).toBe(true);expect(color()).toBe(old);
  camera.rotateY(Math.PI);camera.updateMatrixWorld();
  expect(update(1800,camera,false)).toBe(false);
  camera.position.z+=3000;camera.lookAt(point);camera.updateMatrixWorld();
  expect(update(1800,camera,false)).toBe(true);
  expect(update(1900,camera,false)).toBe(false);
});
