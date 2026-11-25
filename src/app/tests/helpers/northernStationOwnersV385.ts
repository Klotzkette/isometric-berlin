import { expect } from "bun:test";
import { Group, InstancedMesh, type Object3D } from "three";

const originalChildren = new WeakMap<Group, Object3D[]>();

export function captureStationOwners(root:Object3D):Group[] {
  const found:Group[] = [];
  root.traverse(group=>{
    if(group instanceof Group && ["Gesundbrunnen","Landsberger Allee"].includes(group.userData.stationName)) {
      expect(originalChildren.has(group)).toBe(false);
      originalChildren.set(group,group.children.slice());
      found.push(group);
    }
  });
  expect(found).toHaveLength(2);
  return found;
}

export function expectStationOwners(stations:Group[],native:boolean,active:boolean) {
  for(const station of stations) {
    const original = originalChildren.get(station)!;
    expect(original.length).toBeGreaterThan(0);
    for(const [index,child] of original.entries()){
      expect(station.children[index]).toBe(child);
      expect(child.parent).toBe(station);
      expect(child.visible).toBe(!active);
    }
    const retained = station.children.slice(original.length);
    if(!active || !original.some(c=>c.userData.transportRingSpanV378)) {
      expect(retained).toHaveLength(0);
      continue;
    }
    expect(retained).toHaveLength(1);
    const [holder] = retained;
    expect(holder.visible).toBe(true);
    expect(holder.children).toHaveLength(1);
    const [mesh] = holder.children;
    expect(mesh instanceof InstancedMesh).toBe(true);
    expect(mesh.visible).toBe(true);
    const gesund = station.userData.stationName === "Gesundbrunnen";
    expect((mesh as InstancedMesh).count).toBe(native?(gesund?260:412):(gesund?190:79));
  }
}
