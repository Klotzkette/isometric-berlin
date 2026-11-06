import {expect,test} from "bun:test";
import {Box3,Mesh,MeshBasicMaterial,MeshStandardMaterial,Vector3} from "three";
import {createGeorgElserMemorial} from "../src/GeorgElserMemorial";
import {GEORG_ELSER_CONTEXT_V325} from "../src/GeorgElserContextV325";

test("built Elser context has two distinct flush quotations and preserves the original profile",()=>{
  const root=createGeorgElserMemorial();
  root.updateMatrixWorld(true);
  const steel=root.getObjectByName("Georg Elser laminated steel profile")!;
  const height=new Box3().setFromObject(steel).getSize(new Vector3());
  expect(height.y).toBeCloseTo(17,4);expect(steel.children).toHaveLength(3);
  const context=root.getObjectByName("Georg Elser built pavement and information context v325")!;
  expect(context.userData.builtQuoteBandsTotal).toBe(2);expect(context.userData.photographicPixelsBundled).toBeFalse();
  const short=root.getObjectByName("Georg Elser pavement inscription quote") as Mesh;
  const long=root.getObjectByName("Georg Elser second pavement inscription quote") as Mesh;
  expect(short.userData.lettering).toBe("Ich habe den Krieg verhindern wollen.");
  expect(long.userData.lettering).toBe(GEORG_ELSER_CONTEXT_V325.secondQuote);
  const band=root.getObjectByName("Georg Elser second built pavement quotation")!;
  const bounds=new Box3().setFromObject(band);expect(bounds.getSize(new Vector3()).y).toBeLessThan(.08);
  expect(bounds.min.y).toBeCloseTo(root.position.y,7);
  for(const mesh of[short,long]){expect(mesh.rotation.x).toBeCloseTo(-Math.PI/2,8);
    expect(mesh.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);expect(mesh.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);}
});

test("vertical information stele uses its own current OSM point rather than the sculpture foot",()=>{
  const root=createGeorgElserMemorial(),board=root.getObjectByName("Georg Elser source-mapped information stele v325")!;
  root.updateMatrixWorld(true);const p=board.getWorldPosition(new Vector3());
  expect(board.userData.osmNodeId).toBe("11395350229");
  expect(p.x).toBeCloseTo(GEORG_ELSER_CONTEXT_V325.informationWorldXZ[0],8);
  expect(p.z).toBeCloseTo(GEORG_ELSER_CONTEXT_V325.informationWorldXZ[1],8);
  expect(Math.abs(p.x-root.position.x)).toBeGreaterThan(8);
  const glass=board.getObjectByName("Information stele transparent glass") as Mesh;
  expect(glass.userData.dayMaterial.transparent).toBeTrue();expect(glass.userData.dayMaterial.opacity).toBeLessThan(.2);
  const size=new Box3().setFromObject(board).getSize(new Vector3());expect(size.y).toBeCloseTo(2.28,6);
  expect(board.userData.headingStatus).toContain("estimate");
});
