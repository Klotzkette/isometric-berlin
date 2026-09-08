import { describe, expect, test } from "bun:test";
import {
  Box3,
  Group,
  InstancedMesh,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from "three";
import {
  BEETHOVEN_HAYDN_MOZART_PROFILE,
  composerCupolaGeometry,
  createComposerMemorial,
  createComposerMemorialMinecraft,
  MUSIC_COMPOSER_REFINEMENT,
  setComposerMemorialSmoothVisibility,
} from "../src/MusicComposerMemorial";
import {
  createTiergartenLiteraryMemorials,
  lessingStoneCourseGeometry,
  TIERGARTEN_LITERARY_MEMORIALS_PROFILE,
} from "../src/TiergartenLiteraryMemorials";
const anchor = {
  name: "Beethoven-Haydn-Mozart-Denkmal",
  world: [-88.23575241171056, 3.73, 570.9512711009011] as [
    number,
    number,
    number,
  ],
};
function stats(root: Group | InstancedMesh) {
  let renderables = 0,
    stored = 0,
    rendered = 0,
    bytes = 0;
  const geometries = new Set();
  root.traverse((o) => {
    if (!(o instanceof Mesh || o instanceof LineSegments)) return;
    renderables++;
    const n = o.geometry.getAttribute("position").count;
    stored += n;
    rendered += n * (o instanceof InstancedMesh ? o.count : 1);
    if (!geometries.has(o.geometry)) {
      geometries.add(o.geometry);
      for (const a of Object.values(o.geometry.attributes))
        bytes += a.array.byteLength;
      bytes += o.geometry.index?.array.byteLength ?? 0;
    }
    if (o instanceof InstancedMesh)
      bytes +=
        o.instanceMatrix.array.byteLength +
        (o.instanceColor?.array.byteLength ?? 0);
  });
  return { renderables, stored, rendered, bytes };
}
describe("source-bounded composer refinement", () => {
  test("keeps the documented silhouette, three subjects and current roof evidence distinct", () => {
    const root = createComposerMemorial(anchor);
    expect(root.position.toArray()).toEqual(anchor.world);
    expect(new Box3().setFromObject(root).getSize(new Vector3()).y).toBeCloseTo(
      10,
      5,
    );
    expect(MUSIC_COMPOSER_REFINEMENT.subjectAttributes).toHaveLength(3);
    expect(MUSIC_COMPOSER_REFINEMENT.consoleReliefs).toHaveLength(3);
    expect(MUSIC_COMPOSER_REFINEMENT.roof).toContain("pale scaled fields");
    const figure = new Box3();
    for (const name of [
      "Composer memorial Haydn Beethoven Mozart busts",
      "Composer memorial three white-marble portrait heads",
      "Composer memorial differentiated portrait hair",
    ])
      figure.union(new Box3().setFromObject(root.getObjectByName(name)!));
    expect(figure.getSize(new Vector3()).y).toBeGreaterThanOrEqual(1.56);
    expect(figure.getSize(new Vector3()).y).toBeLessThanOrEqual(1.7);
  });
  test("all three pavilion walls and cupola sides are visible from outside with FrontSide materials", () => {
    const root = createComposerMemorial({
      name: anchor.name,
      world: [0, 0, 0],
    });
    root.updateMatrixWorld(true);
    const wall = root.getObjectByName(
      "Composer memorial three-sided coloured stele",
    ) as Mesh;
    for (let side = 0; side < 3; side++) {
      const a = (side * Math.PI * 2) / 3 + Math.PI / 6,
        n = new Vector3(Math.cos(a), 0, Math.sin(a));
      const ray = new Raycaster(
        n
          .clone()
          .multiplyScalar(7)
          .setY(3.73 + 2),
        n.clone().negate(),
      );
      const hits = ray.intersectObject(wall);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].distance).toBeGreaterThan(5);
      expect(hits[0].distance).toBeLessThan(5.4);
    }
    const roof = new Mesh(composerCupolaGeometry(), new MeshStandardMaterial());
    roof.updateMatrixWorld(true);
    for (let side = 0; side < 3; side++) {
      const a = (side * Math.PI * 2) / 3 + Math.PI / 6,
        n = new Vector3(Math.cos(a), 0, Math.sin(a));
      const hits = new Raycaster(
        n.clone().multiplyScalar(4).setY(7.2),
        n.clone().negate(),
      ).intersectObject(roof);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].distance).toBeGreaterThan(2.7);
      expect(hits[0].distance).toBeLessThan(3);
    }
  });
  test("keeps roof colour fields, upright pinecones, attached ribs and separate anatomical ornament", () => {
    const root = createComposerMemorial(anchor);
    const roof = root.getObjectByName(
      "Composer memorial three-sided curved scale cupola",
    ) as Mesh;
    expect((roof.material as MeshStandardMaterial).color.getHex()).toBe(
      0xd0cbbd,
    );
    expect(
      (
        root.getObjectByName(
          "Composer memorial three upward pinecones",
        ) as InstancedMesh
      ).count,
    ).toBe(3);
    expect(
      root.getObjectByName(
        "Composer memorial roof ribs and laurel leaves bodies",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      root.getObjectByName(
        "Composer memorial carved portrait console and scale details bodies",
      ),
    ).toBeInstanceOf(Mesh);
    expect(stats(root)).toEqual({
      renderables: 31,
      stored: 16777,
      rendered: 20659,
      bytes: 394297,
    });
    root.traverse((o) => {
      if (o instanceof Mesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials)
          expect((m as MeshStandardMaterial).map ?? null).toBeNull();
      }
    });
  });
  test("Minecraft preserves ten metres in one deterministic cube batch and hides its smooth alternative", () => {
    const a = createComposerMemorialMinecraft(),
      b = createComposerMemorialMinecraft();
    expect(a.count).toBe(951);
    expect(a.geometry.getAttribute("position").count).toBe(24);
    expect(Array.from(a.instanceMatrix.array)).toEqual(
      Array.from(b.instanceMatrix.array),
    );
    expect(new Box3().setFromObject(a).getSize(new Vector3()).y).toBeCloseTo(
      10,
      5,
    );
    expect(stats(a).bytes).toBe(73116);
    const root = new Group();
    const smooth = createComposerMemorial(anchor);
    root.add(smooth);
    setComposerMemorialSmoothVisibility(root, false);
    expect(smooth.visible).toBeFalse();
    setComposerMemorialSmoothVisibility(root, true);
    expect(smooth.visible).toBeTrue();
    expect(
      BEETHOVEN_HAYDN_MOZART_PROFILE.presentationFocus.targetWorldM,
    ).toEqual(anchor.world);
  });
});
describe("Lessing four-sided pedestal and sculptural reading", () => {
  test("chamfered-square courses have outward faces, upward tops and genuinely recessed cornice midfaces", () => {
    const g = lessingStoneCourseGeometry(1.5, 1.5, 0.3, true);
    const mesh = new Mesh(g, new MeshStandardMaterial());
    mesh.updateMatrixWorld(true);
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2,
        n = new Vector3(Math.sin(a), 0, Math.cos(a));
      const hit = new Raycaster(
        n.clone().multiplyScalar(3).setY(0.15),
        n.clone().negate(),
      ).intersectObject(mesh)[0];
      expect(hit).toBeDefined();
      expect(hit.distance).toBeCloseTo(3 - 1.5 * 0.72, 5);
    }
    const top = new Raycaster(
      new Vector3(0, 2, 0),
      new Vector3(0, -1, 0),
    ).intersectObject(mesh)[0];
    expect(top).toBeDefined();
    expect(top.point.y).toBeCloseTo(0.3, 5);
  });
  test("book pose retains an open hip elbow and independently separate legs without shifting its source anchor", () => {
    const m = createTiergartenLiteraryMemorials().getObjectByName(
      "Lessing-Denkmal exact literary memorial",
    )!;
    expect(m.position.toArray()).toEqual(
      TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing.worldM,
    );
    expect(m.userData.pedestalPlan).toContain("four concave");
    // Probe real structural triangles in local coordinates; mantle is behind the legs.
    m.position.set(0, 0, 0);
    m.rotation.set(0, 0, 0);
    m.updateMatrixWorld(true);
    const structural = m.getObjectByName(
      "Lessing memorial structural silhouette bodies",
    )!;
    const gap = new Raycaster(
      new Vector3(0, 4.55, 2),
      new Vector3(0, 0, -1),
    ).intersectObject(structural)[0];
    const leg = new Raycaster(
      new Vector3(0.2, 4.55, 2),
      new Vector3(0, 0, -1),
    ).intersectObject(structural)[0];
    expect(leg).toBeDefined();
    expect(gap).toBeDefined();
    expect(leg.distance).toBeLessThan(gap.distance);
  });
});
