import { expect, test } from "bun:test";
import { InstancedMesh } from "three";
import source from "../src/data/cityRecognitionV182.json";
import receipt from "../src/data/townhallV227Previous.json";
import { createCityRecognitionV182 } from "../src/CityRecognitionV182";
import { keepTownhallBoxV182V227, keepTownhallSegmentV182V227 } from "../src/townhallPreviousV227";
import { restoreTownhallPreviousForTestV227 } from "./helpers/townhallPreviousV227";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

test("two source-bound civic window exceptions fail open when a value or index changes", () => {
  expect(source.boxes.filter((row,i)=>!keepTownhallBoxV182V227(row,i)).length).toBe(2749);
  expect(source.segments.filter((row,i)=>!keepTownhallSegmentV182V227(row,i)).length).toBe(5930);
  for(const [kind,keep] of [["boxes",keepTownhallBoxV182V227],["segments",keepTownhallSegmentV182V227]] as const) {
    for(const item of receipt[kind]) {
      expect(keep(item.row,item.index)).toBeFalse();
      expect(keep([item.row[0]+.01,...item.row.slice(1)],item.index)).toBeTrue();
    }
  }
  for(const [i,row] of source.segments.entries()) if(row[6]===0x62696a) expect(keepTownhallSegmentV182V227(row,i)).toBeTrue();
});

const prior = {
  day: "af4267b24dc292b4641d8fd191c0bf19e12c489fc02ca90dab535fe9e11132a2",
  minecraft: "4db168f643d69d02374f121a88a8ad7ca58746ff5a30f8848235d53ff7ceecb3",
};
for(const native of [false,true]) test(`${native ? "native" : "drawn"}: reconstructing only exact estimate rows reproduces the complete released civic bytes`,()=>{
  const root=createCityRecognitionV182(native,false,true);
  try {
    const current=outlineSignature(root),mesh=root.children.find(c=>c instanceof InstancedMesh) as InstancedMesh;
    const matrix=mesh.instanceMatrix,color=mesh.instanceColor,count=mesh.count;
    const restore=restoreTownhallPreviousForTestV227(root,native);
    try { expect(outlineSignature(root).sha256).toBe(prior[native?"minecraft":"day"]); }
    finally { restore(); }
    expect(outlineSignature(root)).toEqual(current);
    expect(mesh.instanceMatrix).toBe(matrix);expect(mesh.instanceColor).toBe(color);expect(mesh.count).toBe(count);
    mesh.instanceMatrix.array[12]+=.5;
    const reverse=restoreTownhallPreviousForTestV227(root,native);
    try { expect(outlineSignature(root).sha256).not.toBe(prior[native?"minecraft":"day"]); }
    finally { reverse(); }
  } finally { disposeStaticAudit(root); }
});
