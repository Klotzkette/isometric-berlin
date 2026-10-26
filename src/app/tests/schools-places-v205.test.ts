import { expect, test } from "bun:test";
import { Group, InstancedMesh } from "three";
import { appendSchoolPlaceV205 } from "../src/schoolsPlacesV205Batches";
import courtyard from "../src/data/steglitzCourtyardV251.json";
import courtGround from "../src/data/steglitzCourtGroundV251.json";
import windows from "../src/data/steglitzWindowsV273.json";

test("school and square refinements keep full static detail in small finite batches",()=>{
  for(const native of [false,true]) {
    const root=new Group();appendSchoolPlaceV205(root,"schools",native);appendSchoolPlaceV205(root,"places",native);
    expect(root.children.length).toBe(7); // Lennon and Choriner use their corrected existing batches.
    let count=0,bytes=0,gipsCount=0,windowOwners=0;
    for(const child of root.children) {
      const mesh=child as InstancedMesh;
      expect(mesh.userData.fullStaticDetailOnTouch).toBe(true);
      expect(mesh.userData.sourceGeometryRetained).toBe(true);
      expect(mesh.userData.sourceOwner).toBeTruthy();
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.boundingBox!.isEmpty()).toBe(false);
      expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
      expect(mesh.instanceMatrix.count).toBe(mesh.count);
      if(mesh.userData.gipsKoppenV252)gipsCount+=mesh.count;
      if(mesh.userData.steglitzWindowsV273)windowOwners+=1;
      count+=mesh.count;bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;
      if(native)for(let i=0;i<mesh.count;i++)for(const k of [1,2,4,6,8,9])expect(mesh.instanceMatrix.array[i*16+k]).toBe(0);
      mesh.geometry.dispose();mesh.userData.dayMaterial.dispose();mesh.userData.nightMaterial.dispose();mesh.dispose();
    }
    // Preserve the previous bound separately; v251 has its own small, tested
    // photo-led payload. Global live residency limits stay unchanged.
    const added = native ? courtyard.nativeRows.length + courtGround.nativeRows.length
      : courtyard.boxes.length + courtyard.rods.length + courtGround.boxes.length + courtGround.rods.length;
    // Keep the v205 and v251 ceilings intact. The full v273 addition is guarded
    // separately by its exact rows and actual-factory tests, not hidden in v205.
    const windowAdded = native ? windows.nativeRows.length : windows.boxes.length + windows.rods.length;
    expect(windowOwners).toBe(1);
    expect(windowAdded).toBe(native ? 3854 : 2611);
    expect(windowAdded*76).toBeLessThan(native ? 310_000 : 210_000);
    // Exact receipted replacement, including the procedural shop lettering.
    expect(gipsCount).toBe(native ? 3389 : 1348);
    const gipsDelta = gipsCount - (native ? 285 : 246);
    expect(count - added - gipsDelta - windowAdded).toBeLessThan(native ? 4600 : 3300);
    expect(bytes - (added + gipsDelta + windowAdded) * 76).toBeLessThan(360_000);
    expect(added).toBeLessThan(native ? 3200 : 1800);
  }
});
