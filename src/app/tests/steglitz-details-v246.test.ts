import { expect, test } from "bun:test";
import { Color, InstancedMesh, Matrix4, Vector3 } from "three";
import { createMinecraftSteglitzV182, createSteglitzV182 } from "../src/SteglitzV182";
import source from "../src/data/steglitzV182Source.json";
import native from "../src/data/steglitzV182Native.json";
import additions from "../src/data/steglitzV246Details.json";

function checkRows(mesh: InstancedMesh, rows: number[][], block: boolean): void {
  const m = new Matrix4(), scale = new Vector3(), color = new Color();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (block) m.identity(); else m.makeRotationY(row[6]);
    m.scale(scale.set(row[3], row[4], row[5])); m.setPosition(row[0], row[1], row[2]);
    const expected = new Float32Array(m.elements);
    expect(Array.from(mesh.instanceMatrix.array.slice(i * 16, (i + 1) * 16))).toEqual(Array.from(expected));
    color.setHex(row[block ? 6 : 7]);
    expect(Array.from(mesh.instanceColor!.array.slice(i * 3, (i + 1) * 3))).toEqual(Array.from(new Float32Array([color.r,color.g,color.b])));
  }
}

test("v246 retains every original instanced box and appends source-bound details to the same batch", () => {
  const drawn = createSteglitzV182(), blocks = createMinecraftSteglitzV182();
  expect(drawn.children.length).toBe(3); expect(blocks.children.length).toBe(1);
  checkRows(drawn.children[2] as InstancedMesh, source.boxes, false);
  checkRows(blocks.children[0] as InstancedMesh, native.boxes, true);
  expect(additions.boxes.length).toBe(534);
  expect(additions.nativeRows.length).toBe(559);
  const mobile=createSteglitzV182({mobileLike:true});
  expect(Array.from((mobile.children[2] as InstancedMesh).instanceMatrix.array)).toEqual(Array.from((drawn.children[2] as InstancedMesh).instanceMatrix.array));
  for (const root of [drawn, blocks, mobile]) root.traverse((o:any)=>{
    if (!o.isMesh && !o.isLineSegments) return;
    o.geometry.dispose();
    for (const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial])) (m as any)?.dispose();
  });
});
