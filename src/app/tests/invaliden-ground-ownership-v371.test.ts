import { expect, test } from "bun:test";
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial } from "three";
import { cutInvalidenGeometryV371, cutInvalidenGroundRunsV371 } from "../src/invalidenGroundOwnershipV371";
import { invalidenBoundsV371 } from "../src/invalidenBoundsV371";

const [west,north,east,south] = invalidenBoundsV371;
const z = (north+south)/2;
const geometry = (coords: number[], indices?: number[]) => {
  const geo = new BufferGeometry();
  geo.setAttribute("position",new BufferAttribute(new Float32Array(coords),3));
  if (indices) geo.setIndex(indices);
  return geo;
};

test("the new street survey owns the whole rectangular part of a crossing legacy street", () => {
  const road = geometry([west-10,4,z, west+10,6,z, west+10,6,z+20, west-10,4,z+20],[0,1,2,2,3,0]);
  road.userData.exactIndexPending = true;
  road.addGroup(0,3,0); road.addGroup(3,3,1);
  const clipped = cutInvalidenGeometryV371(road);
  expect(clipped).not.toBe(road);
  expect(clipped.userData.exactIndexPending).toBe(true);
  const xyz = clipped.getAttribute("position"), indices = clipped.index!;
  let area = 0;
  for (let i=0;i<indices.count;i+=3) {
    const [a,b,c] = [0,1,2].map(k=>indices.getX(i+k));
    for (const j of [a,b,c]) {
      expect(xyz.getX(j)).toBeLessThanOrEqual(west);
      expect(xyz.getY(j)).toBeCloseTo(4 + (xyz.getX(j)-west+10)/10,5);
    }
    area += Math.abs((xyz.getX(b)-xyz.getX(a))*(xyz.getZ(c)-xyz.getZ(a))-
      (xyz.getX(c)-xyz.getX(a))*(xyz.getZ(b)-xyz.getZ(a)))/2;
  }
  expect(area).toBeCloseTo(200,5);
  expect(clipped.groups.map(g=>g.materialIndex)).toEqual([0,1]);
  expect(clipped.groups.reduce((sum,g)=>sum+g.count,0)).toBe(indices.count);
});

test("preserves both ends of an indexed kerb and keeps distinct source stairs", () => {
  const ink = geometry([900,0,-900, east+10,7,z, west-10,3,z],[2,1]);
  const clipped = cutInvalidenGeometryV371(ink,true);
  const p=clipped.getAttribute("position"), i=clipped.index!;
  expect([...i.array].map(k=>p.getX(k))).toEqual([west-10,west,east,east+10]);
  const steps = geometry([west+10,4,z, west+12,3,z, west+12,3,z+1]);
  expect(cutInvalidenGeometryV371(steps).index!.count).toBe(0);
  expect(cutInvalidenGeometryV371(steps,false,[[0,3]])).toBe(steps);
});

test("ground runs retain their existing outside tops and both colours at the survey edge", () => {
  const slabs=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),3);
  const original=new Matrix4().makeScale(20,3,4).setPosition(west-10,3,north-2);
  slabs.setMatrixAt(0,original);
  slabs.setMatrixAt(1,new Matrix4().makeScale(east-west+8,3,4).setPosition((east+west)/2,5,z));
  slabs.setMatrixAt(2,new Matrix4().makeScale(20,3,4).setPosition(west+30,8,z));
  for(let i=0;i<3;i++)slabs.setColorAt(i,new Color(i===0?0x415141:0x909888));
  cutInvalidenGroundRunsV371(slabs);
  expect(slabs.count).toBe(3);
  const matrix=new Matrix4(), color=new Color();
  slabs.getMatrixAt(0,matrix); expect(matrix.equals(original)).toBe(true);
  for (const [i,x] of [[1,west-2],[2,east+2]]) {
    slabs.getMatrixAt(i,matrix); slabs.getColorAt(i,color);
    expect(matrix.elements[0]).toBe(4); expect(matrix.elements[12]).toBe(x);
    expect(matrix.elements[13]).toBe(5); expect(color.getHex()).toBe(0x909888);
  }
});
