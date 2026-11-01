import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4 } from "three";
import { HBF_CIRCULATION_V291, hbfLocalToWorldV291 } from "../src/HbfCirculationV291";
import { createHbfNativeMovingFixturesV291 } from "../src/HbfStationMotionV291";

describe("Hauptbahnhof native moving escalator geometry v291",()=>{
  test("uses instance colours without enabling an absent vertex colour attribute in either material",()=>{
    const root=createHbfNativeMovingFixturesV291();
    const meshes=root.children.filter((child):child is InstancedMesh=>child instanceof InstancedMesh);
    expect(meshes.length).toBeGreaterThan(16);
    for(const mesh of meshes){
      expect(mesh.geometry.getAttribute("color")).toBeUndefined();
      expect(mesh.instanceColor).not.toBeNull();expect(mesh.instanceColor!.count).toBe(mesh.count);
      for(const material of[mesh.userData.dayMaterial,mesh.userData.nightMaterial]){
        expect(material.vertexColors).toBe(false);expect(material.color.getHex()).toBe(0xffffff);expect(material.map).toBeNull();
      }
      expect(mesh.material).toBe(mesh.userData.dayMaterial);
      for(let i=0;i<mesh.count;i++){
        const rgb=[mesh.instanceColor!.getX(i),mesh.instanceColor!.getY(i),mesh.instanceColor!.getZ(i)];
        expect(rgb.every(value=>Number.isFinite(value)&&value>=0&&value<=1)).toBe(true);
        expect(rgb.reduce((sum,value)=>sum+value,0)).toBeGreaterThan(0);
      }
    }
  });
  test("keeps each cap broad across its own world heading, with no rotated cubes",()=>{
    const root=createHbfNativeMovingFixturesV291();
    const flights=HBF_CIRCULATION_V291.flights.filter(f=>f.kind==="escalator");
    expect(flights).toHaveLength(16);
    for(const flight of flights) {
      const mesh=root.getObjectByName("Minecraft moving escalator steps "+flight.id) as InstancedMesh;
      expect(mesh).toBeInstanceOf(InstancedMesh);
      const a=hbfLocalToWorldV291(flight.from),b=hbfLocalToWorldV291(flight.to);
      const dx=b[0]-a[0],dz=b[2]-a[2],heading=Math.atan2(dz,dx);
      // Project four corners of the full-width tread footprint independently.
      const corners=[-1,1].flatMap(across=>[-1,1].map(along=>[
        -Math.sin(heading)*across*(flight.widthM-.75)/2+Math.cos(heading)*along*.25,
        Math.cos(heading)*across*(flight.widthM-.75)/2+Math.sin(heading)*along*.25,
      ]));
      const width=Math.max(...corners.map(p=>p[0]))-Math.min(...corners.map(p=>p[0]));
      const depth=Math.max(...corners.map(p=>p[1]))-Math.min(...corners.map(p=>p[1]));
      for(let i=0;i<mesh.count;i++) {
        const matrix=new Matrix4();mesh.getMatrixAt(i,matrix);const e=matrix.elements;
        expect(e[0]).toBeCloseTo(width,6);expect(e[5]).toBeCloseTo(.16,6);expect(e[10]).toBeCloseTo(depth,6);
        for(const index of[1,2,3,4,6,7,8,9,11])expect(e[index]).toBe(0);
        const phase=i/mesh.count;
        expect(e[12]).toBeCloseTo(a[0]+dx*phase,4);
        expect(e[13]).toBeCloseTo(a[1]+(b[1]-a[1])*phase-.08,4);
        expect(e[14]).toBeCloseTo(a[2]+dz*phase,4);
      }
      const descriptor=mesh.userData.hbfMotionV291;
      expect(descriptor.from).toEqual(a);expect(descriptor.to).toEqual(b);
      expect(descriptor.direction).toBe(flight.direction);
    }
  });
});
