import { describe, expect, test } from "bun:test";
import {
  BoxGeometry, EdgesGeometry, Group, InstancedMesh, LineBasicMaterial,
  LineSegments, Matrix4, Mesh, MeshStandardMaterial, Vector3,
} from "three";
import {
  createArchitecturalSignature, HAUPTBAHNHOF_TRACK_INSTANCE_CELL_M,
  HAUPTBAHNHOF_TRACK_REPEAT_NAMES, instanceHauptbahnhofTrackRepeats,
  HAUPTBAHNHOF_RAIL_CURVE_A, HAUPTBAHNHOF_RAIL_CURVE_B,
  type ArchitecturalSignature, type HauptbahnhofModelSignature,
} from "../src/ArchitecturalLandmarks";
import { HBF_CIRCULATION_V291 } from "../src/HbfCirculationV291";
import { interleaveStaticGeometry } from "../src/interleaveStaticGeometry";

const manifest = await Bun.file(new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url)).json();

describe("Hauptbahnhof opaque track repetition", () => {
  test("retains original track courses and adds the evidenced third island and two outer courses in bounded cells", () => {
    const signature = (manifest.architectural_signatures as ArchitecturalSignature[])
      .find((item):item is HauptbahnhofModelSignature => item.id === "hauptbahnhof-model"&&item.kind==="hauptbahnhof_model")!;
    const station = createArchitecturalSignature(signature)!;
    for (const [name, count] of HAUPTBAHNHOF_TRACK_REPEAT_NAMES.map((name, i) => [name, [432, 60, 36][i]] as const)) {
      const batches = station.children.filter(object => object.name === name) as Mesh[];
      expect(batches.reduce((sum, batch) => sum + (batch instanceof InstancedMesh ? batch.count : 1), 0)).toBe(count);
      // Chord-correct platform sections have different exact box lengths.
      // Bound batches by actual source cell/shape identities and require each
      // compatible identity to be packed once, rather than capping all shapes
      // at the ten cells of the uniform rail geometry.
      const sourceKeys=new Set<string>(),actualKeys=new Set<string>();
      const key=(x:number,w:number,h:number,d:number):string=>JSON.stringify([Math.floor(x/HAUPTBAHNHOF_TRACK_INSTANCE_CELL_M),w,h,d]);
      const curve=(x:number):number=>HAUPTBAHNHOF_RAIL_CURVE_A*x*x+HAUPTBAHNHOF_RAIL_CURVE_B*x;
      if(name==="Hauptbahnhof upper platform") {
        const steps=Math.max(20,Math.round(224/12));
        for(const z of HBF_CIRCULATION_V291.upperPlatformCentresLocalZ)for(let i=0;i<steps;i++) {
          const x0=-112+i/steps*224,x1=-112+(i+1)/steps*224,z0=curve(x0)-curve(0)+z,z1=curve(x1)-curve(0)+z;
          sourceKeys.add(key((x0+x1)/2,Math.hypot(x1-x0,z1-z0)*1.02,.42,4.3));
        }
      } else {
        const length=signature.east_west_roof_length_m+110,steps=Math.max(24,Math.round(length/12)),west=-signature.east_west_roof_length_m/2-110;
        for(let i=0;i<steps;i++) {
          const x0=west+i/steps*length,x1=west+(i+1)/steps*length;
          sourceKeys.add(key((x0+x1)/2,length/steps*1.02,name==="Hauptbahnhof upper-level rail"?.16:1.1,name==="Hauptbahnhof upper-level rail"?.14:signature.east_west_roof_width_m-.4));
        }
      }
      const uncut=batches.filter(batch=>!batch.geometry.userData.hbfAperturesV291);
      expect(new Set(uncut.map(batch=>(batch.material as MeshStandardMaterial).uuid)).size).toBe(1);
      for(const batch of uncut) {
        expect(batch.geometry).toBeInstanceOf(BoxGeometry);
        const parameters=(batch.geometry as BoxGeometry).parameters,matrix=new Matrix4(),xs:number[]=[];
        if(batch instanceof InstancedMesh)for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);xs.push(matrix.elements[12]);}
        else xs.push(batch.position.x);
        const identities=new Set(xs.map(x=>key(x,parameters.width,parameters.height,parameters.depth)));
        expect(identities.size).toBe(1);
        const identity=[...identities][0];expect(sourceKeys.has(identity)).toBe(true);expect(actualKeys.has(identity)).toBe(false);actualKeys.add(identity);
      }
      expect(uncut.length).toBeLessThanOrEqual(sourceKeys.size);
      expect(actualKeys.size).toBe(uncut.length);
      expect(batches.filter(batch=>batch.geometry.userData.hbfAperturesV291).length).toBeLessThanOrEqual(count);
      for (const batch of batches) {
        if (!(batch instanceof InstancedMesh)) {
          if(batch.geometry.userData.hbfAperturesV291)expect(batch.geometry.getAttribute("position").count).toBeGreaterThan(0);
          else expect(batch.geometry.index!.count).toBe(36);
          expect(batch.castShadow && batch.receiveShadow).toBeTrue();
          continue;
        }
        const positions: number[] = [];
        const matrix = new Matrix4();
        for (let i = 0; i < batch.count; i++) {
          batch.getMatrixAt(i, matrix);
          positions.push(matrix.elements[12]);
        }
        expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(HAUPTBAHNHOF_TRACK_INSTANCE_CELL_M);
        expect(batch.userData.stationTrackSourceParts).toBe(batch.count);
        expect(batch.castShadow && batch.receiveShadow).toBeTrue();
        expect(batch.geometry.index!.count * batch.count).toBe(36 * batch.count);
      }
    }
    expect(station.children.filter(object => object.name === "Hauptbahnhof upper platform model edges")).toHaveLength(60);
    expect(station.children.filter(object => object.name === "Hauptbahnhof east-west elevated track deck model edges")).toHaveLength(36);
  });

  test("keeps exact source attributes, GPU matrices, corner positions, materials and ink through mobile packing", () => {
    const root = new Group();
    root.position.set(23, -7, 61);
    root.rotation.y = 0.47;
    const material = new MeshStandardMaterial({ color: 0x74868b, metalness: 0.78 });
    const originals: Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const box = new Mesh(new BoxGeometry(12.211666666666666, 0.16, 0.14), material);
      box.name = HAUPTBAHNHOF_TRACK_REPEAT_NAMES[0];
      box.position.set(-19 + i * 5, 10.48, -12 + i * 2);
      box.rotation.y = -0.006 * i;
      box.castShadow = box.receiveShadow = true;
      root.add(box);
      originals.push(box);
    }
    const ink = new LineSegments(new EdgesGeometry(originals[0].geometry), new LineBasicMaterial());
    ink.name = "untouched source outline";
    ink.position.set(1, 2, 3);
    root.add(ink);
    root.updateMatrixWorld();
    const sourceGeometry = originals[0].geometry;
    const attributes = Object.fromEntries(Object.entries(sourceGeometry.attributes)
      .map(([name, attribute]) => [name, Array.from(attribute.array)]));
    const matrices = originals.map(object => Array.from(new Float32Array(object.matrix.elements)));
    const inkGeometry = ink.geometry, inkMaterial = ink.material, inkPose = ink.matrixWorld.clone();
    instanceHauptbahnhofTrackRepeats(root);
    const batches = root.children.filter(object => object instanceof InstancedMesh) as InstancedMesh[];
    expect(batches).toHaveLength(2);
    const instanceStorage = batches.map(batch => batch.instanceMatrix);
    interleaveStaticGeometry(root);
    root.updateMatrixWorld();
    const actualMatrices: number[][] = [];
    batches.forEach((batch, batchIndex) => {
      expect(batch.material).toBe(material);
      expect(batch.instanceMatrix).toBe(instanceStorage[batchIndex]);
      for (const [name, values] of Object.entries(attributes)) {
        const attribute = batch.geometry.getAttribute(name);
        const packed: number[] = [];
        for (let i = 0; i < attribute.count; i++)
          for (let component = 0; component < attribute.itemSize; component++)
            packed.push(attribute.getComponent(i, component));
        expect(packed).toEqual(values);
      }
      for (let i = 0; i < batch.count; i++) {
        const instance = new Matrix4();
        batch.getMatrixAt(i, instance);
        actualMatrices.push(instance.elements.slice());
        const sourceIndex = matrices.findIndex(matrix => matrix.every((value, component) => value === instance.elements[component]));
        expect(sourceIndex).toBeGreaterThanOrEqual(0);
        const sourceGpuMatrix = new Matrix4().fromArray(matrices[sourceIndex]);
        const sourcePosition = originals[sourceIndex].geometry.getAttribute("position");
        const position = batch.geometry.getAttribute("position");
        for (let vertex = 0; vertex < position.count; vertex++) {
          const expected = new Vector3().fromBufferAttribute(sourcePosition, vertex).applyMatrix4(sourceGpuMatrix).applyMatrix4(root.matrixWorld);
          const actual = new Vector3().fromBufferAttribute(position, vertex).applyMatrix4(instance).applyMatrix4(batch.matrixWorld);
          expect(actual.toArray()).toEqual(expected.toArray());
        }
      }
    });
    expect(actualMatrices).toEqual(matrices);
    expect(ink.parent).toBe(root);
    expect(ink.geometry).toBe(inkGeometry);
    expect(ink.material).toBe(inkMaterial);
    expect(ink.matrixWorld.elements).toEqual(inkPose.elements);
  });

  test("preserves annotated or transparent objects instead of absorbing their semantics", () => {
    const root = new Group();
    for (let i = 0; i < 2; i++) {
      const object = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ transparent: i === 1 }));
      object.name = HAUPTBAHNHOF_TRACK_REPEAT_NAMES[0];
      if (i === 0) object.userData.nightOnly = true;
      root.add(object);
    }
    const originals = root.children.slice();
    instanceHauptbahnhofTrackRepeats(root);
    expect(root.children).toEqual(originals);
    expect(root.children.some(object => object instanceof InstancedMesh)).toBeFalse();
  });
});
