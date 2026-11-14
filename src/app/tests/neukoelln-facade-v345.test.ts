import {expect,test} from "bun:test";
import {InstancedMesh,Mesh,Matrix4,Vector3} from "three";
import arcaden from "../src/data/neukoellnLandmarksV305Core.json";
import places from "../src/data/neukoellnPlacesV210.json";
import recognition from "../src/data/cityRecognitionV182.json";
import {arcadenFacadeDetailV345,neukoellnPlacesDetailV345,estrelHotelDetailV345} from "../src/NeukoellnFacadeDetailV345";
import {createNeukoellnLandmarksV305,hasCompleteNeukoellnLandmarksV305} from "../src/NeukoellnLandmarksV305";
import {createNeukoellnPlacesV210} from "../src/NeukoellnPlacesV210";
import {createCityRecognitionV182} from "../src/CityRecognitionV182";

test("photographic relief belongs only to exact current venue panels and does not mutate its hosts",()=>{
  const snapshot=JSON.stringify([arcaden,places,recognition]);
  for(const native of [false,true]){
    const a=arcadenFacadeDetailV345(native,native?arcaden.nativeBoxes:arcaden.fittings);
    const p=neukoellnPlacesDetailV345(native,native?places.blocks:places.boxes);
    const e=estrelHotelDetailV345(native,recognition.boxes);
    expect(a.length).toBeGreaterThan(2500);expect(p.length).toBeGreaterThan(1000);expect(e.length).toBe(1494*4);
    for(const {row} of [...a,...p,...e]){
      expect(row).toHaveLength(8);expect(row.every(Number.isFinite)).toBeTrue();
      expect(Math.min(...row.slice(3,6))).toBeGreaterThan(0);
      if(native)expect(row[6]).toBe(0);
    }
    const src=native?arcaden.nativeBoxes:arcaden.fittings;
    for(const {row,host} of a){
      const old=src[host],width=native?Math.max(old[3],old[5]):old[3];
      expect(old[7]).toBe(0x5e7278);
      const u=native?(old[3]<old[5]?row[2]-old[2]:row[0]-old[0]):
        (row[0]-old[0])*Math.cos(old[6])-(row[2]-old[2])*Math.sin(old[6]);
      expect(Math.abs(u)+(native?Math.max(row[3],row[5]):row[3])/2).toBeLessThanOrEqual(width/2+.000001);
      expect(Math.abs(row[1]-old[1])+row[4]/2).toBeLessThanOrEqual(old[4]/2+.000001);
    }
  }
  expect(JSON.stringify([arcaden,places,recognition])).toBe(snapshot);
  expect(arcadenFacadeDetailV345(false,[])).toEqual([]);
  expect(estrelHotelDetailV345(false,[[5801,5,5100,2.35,1.65,.08,0,0x111111]])).toEqual([]);
});

test("Arcaden addition preserves the complete source body and all earlier instanced members, on touch too",()=>{
  for(const native of [false,true]){
    const before=createNeukoellnLandmarksV305(native);
    const after=createNeukoellnLandmarksV305(native,{facadeDetailV345:true,mobileLike:true});
    expect(hasCompleteNeukoellnLandmarksV305(before,native)).toBeTrue();
    expect(hasCompleteNeukoellnLandmarksV305(after,native)).toBeTrue();
    expect(after.children.length).toBe(before.children.length);
    before.children.forEach((child,i)=>{
      const current=after.children[i] as Mesh;
      if(child instanceof InstancedMesh&&current instanceof InstancedMesh){
        expect(current.instanceMatrix.array.slice(0,child.count*16)).toEqual(child.instanceMatrix.array);
        expect(current.instanceColor!.array.slice(0,child.count*3)).toEqual(child.instanceColor!.array);
      }else if(child instanceof Mesh){
        expect(current.geometry.getAttribute("position").array).toEqual(child.geometry.getAttribute("position").array);
        expect(current.geometry.index!.array).toEqual(child.geometry.index!.array);
      }
    });
  }
});

test("Richardplatz, Hermannplatz and Estrel leave all prior source geometry and furniture exact",()=>{
  for(const native of [false,true]){
    const a=createNeukoellnPlacesV210(native),b=createNeukoellnPlacesV210(native,{facadeDetailV345:true});
    expect(b.children).toHaveLength(a.children.length+1);
    expect((b.children[0]as InstancedMesh).instanceMatrix.array).toEqual((a.children[0]as InstancedMesh).instanceMatrix.array);
    expect((b.children[0]as InstancedMesh).instanceColor!.array).toEqual((a.children[0]as InstancedMesh).instanceColor!.array);
    const c=createCityRecognitionV182(native,false,true,true,true,true);
    const d=createCityRecognitionV182(native,false,true,true,true,true,true);
    const old=c.children[1]as InstancedMesh,next=d.children[1]as InstancedMesh;
    expect(next.instanceMatrix.array.slice(0,old.count*16)).toEqual(old.instanceMatrix.array);
    expect(next.instanceColor!.array.slice(0,old.count*3)).toEqual(old.instanceColor!.array);
    expect(next.count-old.count).toBe(1494*4);
    if(native){const matrix=new Matrix4(),scale=new Vector3();for(let i=old.count;i<next.count;i++){
      next.getMatrixAt(i,matrix);scale.setFromMatrixScale(matrix);
      expect(matrix.elements[1]).toBe(0);expect(matrix.elements[2]).toBe(0);expect(matrix.elements[4]).toBe(0);
      expect(matrix.elements[6]).toBe(0);expect(matrix.elements[8]).toBe(0);expect(matrix.elements[9]).toBe(0);
      expect(Math.min(scale.x,scale.y,scale.z)).toBeGreaterThan(0);
    }}
  }
});
