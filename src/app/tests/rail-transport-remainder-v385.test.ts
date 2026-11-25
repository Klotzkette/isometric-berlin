import { expect,test } from "bun:test";
import { Color, InstancedMesh, Raycaster, Vector3 } from "three";
import { createRailStationsV190 } from "../src/RailStationsV190";
import { createRailSseArchitectureV307 } from "../src/RailSseArchitectureV307";
import { createNorthernNavigationV309 } from "../src/NorthernNavigationV309";
import { createRailTransportRemainderV385, railTransportCarSolidsV385 } from "../src/railTransportRemainderV385";
import { railSseGroundAtV307, railSseGroundOffsetV307 } from "../src/railSseNavigationV307";
import { createMinecraftMaterialState, disposeMinecraftMaterialState, hasMinecraftMaterialProvenance,
  releaseCopiedMinecraftMaterialPresentation, setMinecraftMaterialPresentation } from "../src/visual-modes/minecraft/materialMode";

const paint=new Color(0xd9d6c4).toArray().map(Math.fround);
function inspect(mesh:InstancedMesh,start=0) {
  const tactile:number[][]=[],cars:number[][]=[];
  const rgb=mesh.instanceColor!.array, rows=mesh.instanceMatrix.array;
  for(let i=start;i<mesh.count;i++) {
    const row=[...rows.subarray(i*16,i*16+16), ...rgb.subarray(i*3,i*3+3)];
    (paint.every((value,k)=>value===row[16+k]) ? tactile : cars).push(row);
  }
  return { tactile,cars, area:tactile.reduce((sum,row)=>sum+Math.abs(row[0]*row[10]-row[2]*row[8]),0) };
}
function rayY(mesh:InstancedMesh|ReturnType<typeof createRailSseArchitectureV307>,x:number,z:number,y:number) {
  return new Raycaster(new Vector3(x,y,z),new Vector3(0,-1,0)).intersectObject(mesh,true)[0]?.point.y;
}
test.each([false,true])("ring train bodies, liveries and tactile strips survive the graded station swap, native=%s",native=>{
  const stations=createRailStationsV190(native), model=createRailSseArchitectureV307(native);
  const solids=railTransportCarSolidsV385(native),nav=createNorthernNavigationV309(solids,()=>true);
  expect(solids.length).toBe(2);
  model.updateMatrixWorld(true);
  const state=createMinecraftMaterialState();
  if(native)setMinecraftMaterialPresentation(stations,state,true);
  for(const name of ["Gesundbrunnen","Landsberger Allee"]) {
    const host=stations.children.find(c=>c.userData.stationName===name)!;
    const batch=host.children.find(c=>c.userData.stationName===name) as InstancedMesh;
    const start=batch.userData.transportRingSpanV378.start;
    const old=inspect(batch,start),matrices=batch.instanceMatrix.array.slice(),rgb=batch.instanceColor!.array.slice();
    const rest=createRailTransportRemainderV385(batch,name,native,start),fresh=inspect(rest);
    expect(batch.instanceMatrix.array).toEqual(matrices);
    expect(batch.instanceColor!.array).toEqual(rgb);
    expect(rest.geometry).toBe(batch.geometry);
    expect(rest.userData.dayMaterial).toBe(batch.userData.dayMaterial);
    expect(rest.userData.nightMaterial).toBe(batch.userData.nightMaterial);
    expect(rest.userData.schwellenraumMaterial).toBe(batch.userData.schwellenraumMaterial);
    if(native)expect(hasMinecraftMaterialProvenance(rest,rest.userData.dayMaterial,rest.material)).toBe(true);
    expect(fresh.area).toBeCloseTo(old.area,3);
    expect(fresh.cars.length).toBe(old.cars.length);
    rest.updateMatrixWorld(true);
    for(const [i,newRow] of fresh.cars.entries()) {
      const oldRow=old.cars[i],x=newRow[12],z=newRow[14];
      const hi=x<1313 ? [1303.826,-3336.7955] : [1322.151,-3337.5045];
      expect(newRow[13]-oldRow[13]).toBeCloseTo(railSseGroundOffsetV307(hi[0],hi[1],native),4);
      expect(newRow.filter((_,k)=>k!==13)).toEqual(oldRow.filter((_,k)=>k!==13));
      expect(newRow[13]+newRow[5]/2).toBeGreaterThan(railSseGroundAtV307(x,z,native)??3);
    }
    if(name==="Gesundbrunnen") {
      expect(fresh.cars.length).toBeGreaterThan(50);
      for(const [x,z] of [[1303.826,-3336.7955],[1322.151,-3337.5045]]) {
        const ground=railSseGroundAtV307(x,z,native)!;
        const carRoof=rayY(rest,x,z,25)!;
        expect(carRoof-ground).toBeGreaterThan(3.6);
        expect(carRoof-ground).toBeLessThan(3.9);
        expect(nav.solidAt(x,ground+2,z)).toBe(true);
        expect(nav.solidAt(x,carRoof+.2,z)).toBe(false);
        expect(nav.solidAt(x,ground+2,z+3)).toBe(false);
      }
    } else expect(fresh.cars.length).toBe(0);
    // Check contact with the actual native and triangulated smooth platforms.
    let attached=0;
    for(let i=1;i<fresh.tactile.length;i+=Math.max(1,Math.floor(fresh.tactile.length/24))) {
      const row=fresh.tactile[i],x=row[12],z=row[14],top=row[13]+row[5]/2;
      const under=rayY(model,x,z,top+.005);
      const visible=rayY(rest,x,z,top+.005);
      expect(visible).toBeDefined();
      expect(row[13]).toBeGreaterThanOrEqual((railSseGroundAtV307(x,z,native)??3)-.01);
      if(under!==undefined && top-under>=0 && top-under<.09) attached++;
    }
    expect(attached).toBeGreaterThan(4);
    releaseCopiedMinecraftMaterialPresentation(rest);rest.dispose();
  }
  disposeMinecraftMaterialState(state);
});
