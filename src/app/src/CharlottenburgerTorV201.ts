import { Group, Matrix4, Vector3 } from "three";
import { addBox, addCone, addCylinder, createBuilder, finishDrawnGroup, type Builder } from "./drawnKit";
import { CHARLOTTENBURGER_TOR_PROFILE } from "./charlottenburgerTorV201Profile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

const SANDSTONE = 0xd8c6a8, BRONZE = 0x557e6d;
function rotatedLocalOffset(x: number, z: number, r: number): [number, number] {
  return [x * Math.cos(r) + z * Math.sin(r), -x * Math.sin(r) + z * Math.cos(r)];
}
function addLocalBox(builder: Builder, color: number, origin: Vector3,
  x: number, y: number, z: number, w: number, h: number, d: number, r: number, inked = true): void {
  const [dx, dz] = rotatedLocalOffset(x, z, r);
  addBox(builder, color, origin.x + dx, y, origin.z + dz, w, h, d, r, inked);
}

/** Retain all v116 primitives; only the complete wing's source frame changes. */
export function buildCharlottenburgerTorWingV201(side: -1 | 1, sourcePlacement = true,
  point = new Vector3(...CHARLOTTENBURGER_TOR_PROFILE.anchorWorldM)): Builder {
  const builder = createBuilder();
  const rotation = 0.087;
  const wingZ = side * (CHARLOTTENBURGER_TOR_PROFILE.roadOpeningM / 2 + 3.2);
    // Schaede's two gate wings are colonnades north and south of the road,
    // rather than the two tower blocks formerly placed along its centreline.
    for (const localX of [-11.2, 11.2]) {
      addLocalBox(builder, SANDSTONE, point, localX, point.y + 8.6, wingZ,
        4.3, 17.2, 5.6, rotation);
      addLocalBox(builder, 0xa79a80, point, localX, point.y + 18.3, wingZ,
        5.2, 2.2, 6.3, rotation);
    }
    for (const localX of [-6.6, -2.2, 2.2, 6.6]) {
      const [offsetX, offsetZ] = rotatedLocalOffset(localX, wingZ, rotation);
      addCylinder(builder, SANDSTONE, point.x + offsetX, point.y + 9.0,
        point.z + offsetZ, 0.72, 14.4, 12);
      addLocalBox(builder, 0xb4aa91, point, localX, point.y + 2.0, wingZ,
        1.75, 0.7, 1.75, rotation);
      addLocalBox(builder, 0xb4aa91, point, localX, point.y + 16.1, wingZ,
        1.6, 0.65, 1.6, rotation);
    }
    addLocalBox(builder, SANDSTONE, point, 0, point.y + 17.15, wingZ,
      26.8, 1.8, 6.0, rotation);
    addLocalBox(builder, 0xa89b82, point, 0, point.y + 19.45, wingZ,
      28.2, 2.8, 6.5, rotation);
    for (const localX of [-8, -4, 0, 4, 8]) {
      addLocalBox(builder, 0x958970, point, localX, point.y + 19.45,
        wingZ + side * 3.31, 1.45, 0.62, 0.16, rotation, false);
    }
    const statuePartStart = builder.parts.length, statueEdgeStart = builder.edges.length;
    // Friedrich I and Sophie Charlotte on the Tiergarten-facing side.
    const statueX = side < 0 ? -11.2 : 11.2;
    const [statueOffsetX, statueOffsetZ] = rotatedLocalOffset(
      statueX,
      wingZ - side * 3.45,
      rotation,
    );
    addCylinder(builder, BRONZE, point.x + statueOffsetX, point.y + 8.0,
      point.z + statueOffsetZ, 1.2, 3.8, 10);
    addCone(builder, BRONZE, point.x + statueOffsetX, point.y + 11.0,
      point.z + statueOffsetZ, 1.35, 3.1, 10);
    addCylinder(builder, BRONZE, point.x + statueOffsetX, point.y + 13.0,
      point.z + statueOffsetZ, 0.62, 1.2, 10);
    if (sourcePlacement && side > 0) {
      // v116 put the southern figure on the canal side after source rotation.
      // Translate its complete geometry to the east face; never mirror anatomy.
      const [sx, sz] = rotatedLocalOffset(0, 6.9, rotation);
      for (const part of builder.parts.slice(statuePartStart)) part.translate(sx, 0, sz);
      for (const edge of builder.edges.slice(statueEdgeStart)) edge.translate(sx, 0, sz);
    }
    // The high end pylons and their allegorical bronze groups replace the
    // previous single cones.
    addLocalBox(builder, SANDSTONE, point, -statueX, point.y + 22.0, wingZ,
      4.5, 3.2, 4.7, rotation);
    const [crownX, crownZ] = rotatedLocalOffset(-statueX, wingZ, rotation);
    for (const crownSide of [-1, 1]) {
      addCone(builder, BRONZE, point.x + crownX + crownSide * 1.0,
        point.y + 25.1, point.z + crownZ, 0.72, 2.4, 8);
    }

  if (sourcePlacement) {
    const wing = CHARLOTTENBURGER_TOR_PROFILE.wings[side < 0 ? 0 : 1];
    const [dx, dz] = rotatedLocalOffset(0, wingZ, rotation);
    const transform = new Matrix4().makeTranslation(wing.centerWorldM[0], 0, wing.centerWorldM[1])
      .multiply(new Matrix4().makeRotationY(wing.yawRadians - rotation))
      .multiply(new Matrix4().makeTranslation(-point.x - dx, 0, -point.z - dz));
    for (const part of [...builder.parts, ...builder.edges, ...builder.lamps]) part.applyMatrix4(transform);
  }
  return builder;
}

/** Append to the existing merged drawn batch; no extra drawn draw calls. */
export function appendCharlottenburgerTorV201(builder: Builder, point: Vector3): void {
  for (const side of [-1, 1] as const) {
    const wing = buildCharlottenburgerTorWingV201(side, true, point);
    builder.parts.push(...wing.parts); builder.edges.push(...wing.edges); builder.lamps.push(...wing.lamps);
  }
}

/** Small independent factory for inspection; production drawn stays merged. */
export function createCharlottenburgerTorV201(): Group {
  const builder = createBuilder();
  appendCharlottenburgerTorV201(builder, new Vector3(...CHARLOTTENBURGER_TOR_PROFILE.anchorWorldM));
  const root = finishDrawnGroup(builder, { name: "Charlottenburger Tor source-aligned wings v201" })!;
  root.userData.charlottenburgerTor = CHARLOTTENBURGER_TOR_PROFILE;
  root.traverse(object => {
    const geometry = (object as { geometry?: import("three").BufferGeometry }).geometry;
    geometry?.computeBoundingBox(); geometry?.computeBoundingSphere();
  });
  return freezeStaticSceneTransforms(root);
}
