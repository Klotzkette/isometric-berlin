import { describe, expect, test } from "bun:test";
import { Box3, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createCattelanExhibitionV217 } from "../src/CattelanExhibitionV217";
import { CATTELAN_EXHIBITS_V217 } from "../src/CattelanExhibitsV217";
import { createNeueNationalgalerieV183 } from "../src/NeueNationalgalerieV183";
import { NATIONALGALERIE_V183 as P } from "../src/neueNationalgalerieV183Profile";
import { neueNationalgalerieWorldV217 } from "../src/neueNationalgalerieWalkV217";
import { detachNationalgalerieSculpturesV221, nationalgalerieSculpturesV221 } from "./helpers/nationalgalerieSculpturesV221";

function boundsInFrame(object: Group | Mesh, frame: Group): Box3 {
  const bounds = new Box3(), inverse = frame.matrixWorld.clone().invert(), instance = new Matrix4();
  object.traverse(part => {
    if (!(part instanceof Mesh)) return;
    part.geometry.computeBoundingBox();
    const local = inverse.clone().multiply(part.matrixWorld);
    if (part instanceof InstancedMesh) {
      for (let i = 0; i < part.count; i++) {
        part.getMatrixAt(i, instance);
        bounds.union(part.geometry.boundingBox!.clone().applyMatrix4(local.clone().multiply(instance)));
      }
    } else bounds.union(part.geometry.boundingBox!.clone().applyMatrix4(local));
  });
  return bounds;
}

function geometrySummary(root: Group) {
  let bytes = 0, calls = 0;
  const arrays = new Set<ArrayBufferView>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    calls++;
    const add = (array: ArrayBufferView | undefined) => {
      if (array && !arrays.has(array)) { bytes += array.byteLength; arrays.add(array); }
    };
    for (const name of Object.keys(object.geometry.attributes)) add(object.geometry.getAttribute(name).array);
    add(object.geometry.index?.array);
    if (object instanceof InstancedMesh) { add(object.instanceMatrix.array); add(object.instanceColor?.array); }
    expect((object.material as MeshBasicMaterial).map).toBeNull();
    expect(object.geometry.getAttribute("uv")).toBeUndefined();
  });
  return { bytes, calls };
}

describe("complete Neue Nationalgalerie Cattelan integration v217", () => {
  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: complete gallery retains compact full-detail geometry and bounded world placement`, () => {
    const gallery = createNeueNationalgalerieV183(native), summary = geometrySummary(gallery);
    const added = geometrySummary(nationalgalerieSculpturesV221(gallery, native));
    const retainedBounds = new Box3();
    const restore = detachNationalgalerieSculpturesV221(gallery, native);
    try {
      const retained = geometrySummary(gallery);
      retainedBounds.setFromObject(gallery);
      expect(retained.bytes).toBeLessThan(800_000);
      expect(retained.calls).toBeLessThan(25);
      expect(summary).toEqual({ bytes: retained.bytes + added.bytes, calls: retained.calls + added.calls });
    } finally { restore(); }
    const bounds = retainedBounds;
    expect(bounds.min.y).toBeGreaterThan(5);
    expect(bounds.max.y).toBeLessThan(P.floorY + 12);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(130);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(135);
    expect(gallery.userData.sourceIds).toHaveLength(8);
    expect(gallery.userData.columnCount).toBe(8);
    const room = gallery.children.find(child => child.userData.cattelanExhibitionV217) as Group;
    expect(room).toBeDefined();
    expect(room.userData.layoutEstimated).toBe(true);
    expect(room.userData.fullAndMobileIdentical).toBe(true);
    expect(room.userData.textureFree).toBe(true);
    expect(room.getWorldPosition(new Vector3()).toArray()).toEqual([P.center[0], P.floorY, P.center[1]]);
    expect(room.matrixAutoUpdate).toBe(false);
    // Every frame is frozen only after the local scene pose has entered its matrix.
    const probe = new Vector3(11, 2, -7).applyMatrix4(room.matrixWorld);
    const expected = new Vector3(...neueNationalgalerieWorldV217(11, P.floorY + 2, -7));
    expect(probe.distanceTo(expected)).toBeLessThan(1e-8);

    const props = room.children.find(child => child.userData.exhibitInventory) as Group;
    const interior = boundsInFrame(props, room);
    expect(interior.min.x).toBeGreaterThan(-23);
    expect(interior.max.x).toBeLessThan(23);
    expect(interior.min.z).toBeGreaterThan(-23);
    expect(interior.max.z).toBeLessThan(23);
    expect(interior.min.y).toBeGreaterThan(-.00001);
    expect(interior.max.y).toBeLessThan(P.columnHeight);
    for (const part of room.children.filter(child => child instanceof Mesh)) {
      const fitted = boundsInFrame(part as Mesh, room);
      expect(fitted.min.x).toBeGreaterThan(-25.2);
      expect(fitted.max.x).toBeLessThan(25.2);
      expect(fitted.min.z).toBeGreaterThan(-25.2);
      expect(fitted.max.z).toBeLessThan(25.2);
    }
    expect(props.userData.fullStaticDetailOnTouch).toBe(true);
  });

  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: three pink titles use the room, east glazing and street-board planes`, () => {
    const room = createCattelanExhibitionV217(native); room.updateMatrixWorld(true);
    const titles: Group[] = [];
    room.traverse(object => { if (object.userData.cattelanLetteringV217) titles.push(object as Group); });
    expect(titles).toHaveLength(3);
    const expected = [[-15, 1.05, 9.14, 0], [25.39, 4.1, 0, Math.PI / 2], [32.08, 2, 19, Math.PI / 2]];
    titles.forEach((title, i) => {
      expect(title.userData.text).toBe("Cattelan");
      expect(title.userData.photoFitted).toBe(true);
      const origin = title.getWorldPosition(new Vector3());
      const [x, y, z, yaw] = expected[i];
      expect(origin.distanceTo(new Vector3(...neueNationalgalerieWorldV217(x, P.floorY + y, z)))).toBeLessThan(1e-7);
      const normal = new Vector3(0, 0, 1).transformDirection(title.matrixWorld);
      expect(normal.distanceTo(new Vector3(Math.sin(P.yaw + yaw), 0, Math.cos(P.yaw + yaw)))).toBeLessThan(1e-7);
    });
  });

  test("roof drummer and four marble sculptures follow the same final museum frame", () => {
    const gallery = createNeueNationalgalerieV183(); gallery.updateMatrixWorld(true);
    const room = gallery.children.find(child => child.userData.cattelanExhibitionV217) as Group;
    const drummer = room.children.find(child => child.name.includes("small seated drummer")) as Group;
    expect(drummer).toBeDefined();
    expect(drummer.getWorldPosition(new Vector3()).distanceTo(new Vector3(
      ...neueNationalgalerieWorldV217(32.2, P.floorY + 10.2, 0)))).toBeLessThan(1e-7);
    const props = room.children.find(child => child.userData.exhibitInventory) as Group;
    for (const [x, , z] of CATTELAN_EXHIBITS_V217.marbleShrouds) {
      const origin = new Vector3(...neueNationalgalerieWorldV217(x, P.floorY + 1, z));
      const hits = new Raycaster(origin, new Vector3(0, -1, 0), 0, 1).intersectObject(props, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeGreaterThan(P.floorY + .20);
      expect(hits[0].point.y).toBeLessThan(P.floorY + .65);
    }
  });

  test("rebuilding for another device retains exactly the same full drawn resources", () => {
    const first = createCattelanExhibitionV217(), second = createCattelanExhibitionV217();
    expect(geometrySummary(first)).toEqual(geometrySummary(second));
    expect(first.userData.fullAndMobileIdentical).toBe(true);
    expect(second.userData.fullAndMobileIdentical).toBe(true);
    const signatures = (root: Group) => {
      const result: number[][] = [];
      root.traverse(object => {
        if (object instanceof InstancedMesh) result.push(Array.from(object.instanceMatrix.array));
        else if (object instanceof Mesh) result.push(Array.from(object.geometry.getAttribute("position").array));
      });
      return result;
    };
    expect(signatures(first)).toEqual(signatures(second));
  });
});
