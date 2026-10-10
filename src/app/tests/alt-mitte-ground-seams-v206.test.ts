import { describe, expect, test } from "bun:test";
import { BoxGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Color } from "three";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import { createGroundSlabs, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { restoreAltMitteGroundSeamsV206 } from "../src/AltMitteGroundSeamsV206";
import { createDrawnWaterBoundaryCellTester, restoreDrawnWaterBoundary } from "../src/drawnWaterBoundary";
import { indexGeometryExactly } from "../src/exactGeometryIndex";

describe("exact Alt-Mitte drawn grass / road seam ownership", () => {
  test("retains all original instance heights and colors outside proven grass overlaps", () => {
    const slabs = createGroundSlabs(ground as unknown as VoxelPayload, "audit grass", {grass:[0xabcdef],concrete:[0xaabbcc]}, {skipClasses:["asphalt"],parkRelief:"drawn"});
    const matrices = slabs.instanceMatrix.array as Float32Array;
    const colors = slabs.instanceColor!.array as Float32Array;
    const rows = new Map<number, number[]>();
    for (let i=0;i<slabs.count;i++) {
      const z=matrices[i*16+14];let list=rows.get(z);if(!list){list=[];rows.set(z,list);}list.push(i);
    }
    restoreAltMitteGroundSeamsV206(slabs, ground as unknown as VoxelPayload);
    expect(slabs.userData.altMitteGroundSeamCellsV206).toBe(5401);
    expect(slabs.count).toBe(132456);
    const next=slabs.instanceMatrix.array as Float32Array;
    for(let i=0;i<slabs.count;i++){
      const x=next[i*16+12],z=next[i*16+14],width=next[i*16];
      const source=rows.get(z)!.find(index=>Math.abs(matrices[index*16+12]-x)+width/2<=matrices[index*16]/2+0.001)!;
      expect(source).toBeDefined();
      for(const axis of [1,2,3,4,5,6,7,8,9,10,11,13,14,15])expect(next[i*16+axis]).toBe(matrices[source*16+axis]);
      for(let c=0;c<3;c++)expect(slabs.instanceColor!.array[i*3+c]).toBe(colors[source*3+c]);
    }
    let bytes=0,draws=0;
    for(const root of slabs.children)root.traverse((object:any)=>{
      if(!object.geometry)return;
      indexGeometryExactly(object.geometry);draws++;
      bytes+=Object.values(object.geometry.attributes).reduce((sum:number,a:any)=>sum+a.array.byteLength,0)+(object.geometry.index?.array.byteLength??0);
      const positions=object.geometry.getAttribute("position"),normals=object.geometry.getAttribute("normal"),indices=object.geometry.index;
      for(let i=0;i<indices.count;i+=3){
        const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);
        if(normals.getY(a)!==1)continue;
        const normalY=(positions.getZ(b)-positions.getZ(a))*(positions.getX(c)-positions.getX(a))-
          (positions.getX(b)-positions.getX(a))*(positions.getZ(c)-positions.getZ(a));
        expect(normalY).toBeGreaterThanOrEqual(0);
      }
    });
    expect(draws).toBe(42);expect(bytes).toBeLessThan(9_000_000);
  });

  test("optional spans cannot refill prior authored exclusions or differently graded ground", () => {
    const encode=(array:Float32Array|Uint32Array)=>btoa(String.fromCharCode(...new Uint8Array(array.buffer)));
    const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),1);
    // Existing source host only covers the second cell: the first is an authored hole.
    mesh.setMatrixAt(0,new Matrix4().makeScale(4,3,4).setPosition(6,1.5,2));
    mesh.setColorAt(0,new Color(0xabcdef));
    const input={format:"exact-drawn-water-boundary",version:1,cell_m:4,grid:ground.grid,source_sha256:"fixture",ground_sha256:"fixture",
      cells_u32:encode(new Uint32Array([-ground.grid.min_x_idx,-ground.grid.min_z_idx,0,0,0,0])),spans_u32:encode(new Uint32Array([2])),tops_f32:encode(new Float32Array([3])),triangles_f32:"",edges_f32:""};
    const cellTest=createDrawnWaterBoundaryCellTester(ground as unknown as VoxelPayload,input);
    expect(cellTest(2,2)).toBeTrue();expect(cellTest(6,2)).toBeTrue();
    expect(cellTest(-2,2)).toBeFalse();expect(cellTest(10,2)).toBeFalse();expect(cellTest(2,6)).toBeFalse();
    const before=[...mesh.instanceMatrix.array];
    restoreDrawnWaterBoundary(mesh,ground as unknown as VoxelPayload,input);
    expect([...mesh.instanceMatrix.array]).toEqual(before);expect(mesh.children).toHaveLength(0);
    mesh.setMatrixAt(0,new Matrix4().makeScale(8,3,4).setPosition(4,2.5,2));
    const higher=[...mesh.instanceMatrix.array];
    restoreDrawnWaterBoundary(mesh,ground as unknown as VoxelPayload,input);
    expect([...mesh.instanceMatrix.array]).toEqual(higher);expect(mesh.children).toHaveLength(0);
  });
});
