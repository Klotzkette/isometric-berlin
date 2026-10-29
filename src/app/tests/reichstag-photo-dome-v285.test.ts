import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, MeshStandardMaterial, TorusGeometry } from "three";
import { createOfficialReichstagDome, domeRadius, type ArchitecturalSignature } from "../src/ReichstagDome";

const signature: ArchitecturalSignature = {
  anchor_world: [317.729, 27.595, 40.477], diameter_m: 40,
  geometry_status: "official dimensions; owner photograph for fittings",
  height_m: 23.5, horizontal_rings: 17, vertical_ribs: 24,
  id: "reichstag-dome", landmark_name: "Reichstagsgebäude",
  source_url: "https://www.bundestag.de/besuche/architektur/reichstag/kuppel",
};

describe("Reichstag owner-photo steel reading v285", () => {
  test("keeps every measured datum and exposes horizontal bands in front of glass", () => {
    const dome = createOfficialReichstagDome(signature);
    expect(dome.position.toArray()).toEqual(signature.anchor_world);
    expect(dome.userData).toMatchObject({diameterM:40,heightM:23.5,
      photoSteelDetail:{photoEvidenceId:"reichstag-owner-photo-v285"}});
    for (let i=1;i<=17;i++) {
      const ring = dome.getObjectByName(`horizontal steel ring ${i}`) as Mesh<TorusGeometry,MeshStandardMaterial>;
      const t=i/18;
      expect(ring.position.y).toBeCloseTo(t*23.5,8);
      expect(ring.geometry.parameters.radius).toBeCloseTo(domeRadius(t,40)+.25,8);
      expect(ring.geometry.parameters.tube).toBe(.12);
      // Previously .055 m hairlines lay beneath the .24 m glass surface.
      expect(ring.geometry.parameters.radius+ring.geometry.parameters.tube-domeRadius(t,40)).toBeGreaterThan(.24);
      expect(ring.geometry.parameters.radialSegments).toBe(6);
      expect(ring.geometry.parameters.tubularSegments).toBe(96);
      expect(ring.material.color.getHex()).toBe(0x71848b);
      expect(ring.material.map).toBeNull();
    }
    expect((dome.getObjectByName("main steel ribs instanced") as InstancedMesh).count).toBe(24);
    const crown = dome.getObjectByName("dome crown compression and open oculus ring") as Mesh<TorusGeometry>;
    expect(crown.position.y).toBe(23.5);
    expect(crown.geometry.parameters.radius).toBe(5);
  });

  test("retains full interior and the exact previous geometry-buffer allowance", () => {
    const dome=createOfficialReichstagDome(signature);
    let renderables=0,bytes=0; const geometries=new Set();
    dome.traverse(object=>{
      if (!(object instanceof Mesh) && !("isLineSegments" in object)) return;
      const mesh=object as Mesh; renderables++;
      if(mesh instanceof InstancedMesh) bytes+=mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength??0);
      if(geometries.has(mesh.geometry))return;geometries.add(mesh.geometry);
      for(const attr of Object.values(mesh.geometry.attributes))bytes+=attr.array.byteLength;
      bytes+=mesh.geometry.index?.array.byteLength??0;
    });
    expect(renderables).toBe(37);expect(bytes).toBe(1_011_188);
    expect((dome.getObjectByName("daylight mirror cone 360 individual panels") as InstancedMesh).count).toBe(360);
    expect(dome.children.filter(o=>o.name.endsWith("visitor ramp deck"))).toHaveLength(2);
    expect(dome.getObjectByName("Reichstag open observation platform")).toBeDefined();
    expect(dome.getObjectByName("Reichstag aluminium louvre sunshade")).toBeDefined();
  });
});
