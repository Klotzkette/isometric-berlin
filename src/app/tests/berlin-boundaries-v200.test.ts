import {describe,expect,test} from "bun:test";
import {LineSegments} from "three";
import {createBerlinBoundariesV200} from "../src/BerlinBoundariesV200";
import data from "../src/data/berlinBoundariesV200.json";
import {terrainGroundAt} from "../src/weinbergTerrainV176";

describe("Complete thin source boundaries",()=>{
  for(const native of [false,true])test(`${native?"native":"drawn"} exact indexed source and owned disposable buffers`,()=>{
    const root=createBerlinBoundariesV200(native);
    expect(root.children.length).toBe(2);
    expect(root.userData.solidAt).toBeUndefined();expect(root.userData.groundAt).toBeUndefined();
    let bytes=0,disposed=0;
    for(const [i,kind] of (["state","wall"] as const).entries()){
      const line=root.children[i] as LineSegments;
      expect(line instanceof LineSegments).toBe(true);
      const xz=kind==="state"?data.stateXz:data.wallXz;
      const indices=kind==="state"?data.stateSegments:data.wallSegments;
      const positions=line.geometry.getAttribute("position"),index=line.geometry.getIndex()!;
      expect(positions.array.length).toBe(xz.length/2*3);expect(index.array.length).toBe(indices.length);
      for(let j=0;j<indices.length;j++)expect(index.array[j]).toBe(indices[j]);
      for(let j=0;j<xz.length;j+=2){
        expect(positions.array[j/2*3]).toBe(Math.fround(xz[j]));
        expect(positions.array[j/2*3+2]).toBe(Math.fround(xz[j+1]));
        expect(positions.array[j/2*3+1]).toBe(Math.fround(terrainGroundAt(xz[j],xz[j+1],3,native)+.22));
      }
      const material=Array.isArray(line.material)?line.material[0]:line.material;
      expect(material.depthTest).toBe(false);expect(material.depthWrite).toBe(false);
      expect(material.opacity).toBeLessThan(.7);expect(line.matrixAutoUpdate).toBe(false);
      expect(line.geometry.boundingSphere!.radius).toBeGreaterThan(15000);
      expect(line.geometry.getAttribute("uv")).toBeUndefined();
      bytes+=positions.array.byteLength+index.array.byteLength;
      line.geometry.addEventListener("dispose",()=>disposed++);material.addEventListener("dispose",()=>disposed++);
      line.geometry.dispose();material.dispose();
    }
    expect(bytes).toBe(459316);expect(bytes).toBeLessThan(512*1024);expect(disposed).toBe(4);
  });
});
