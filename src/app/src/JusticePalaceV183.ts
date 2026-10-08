import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import source from "./data/justicePalaceV183.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { createCharlottenburgCupolaV183 } from "./CharlottenburgCupolaV183";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const JUSTICE_PALACE_V183_GROUP = "Source-bound Berlin courthouses and Charlottenburg recognition v183";

/** Additive only: retain every source owner and the complete Moabit v166 model. */
export function createJusticePalaceV183(): Group {
  const root = new Group();
  root.name = JUSTICE_PALACE_V183_GROUP;
  root.userData = {
    textureFree: true, additiveOnly: true, sourceGeometryRetained: true,
    fullStaticDetailOnTouch: true, sourceParents: source.features.map(f => f.parentId),
    sourceConflicts: source.sourceConflicts, moabitTowerHierarchy: source.moabitTowerHierarchy,
    estimateStatus: "Facade subdivisions and DOP-aligned upper contours are display estimates; exact source edges retained",
  };
  const positions = new Float32Array(source.segments.length * 6);
  const colors = new Float32Array(positions.length), color = new Color();
  source.segments.forEach((r, i) => {
    for (let j = 0; j < 6; j++) positions[i * 6 + j] = r[j];
    color.setHex(r[6]); color.toArray(colors, i * 6); color.toArray(colors, i * 6 + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const outlines = new LineSegments(geometry, new LineBasicMaterial({ vertexColors: true, depthWrite: false }));
  outlines.name = "Exact source contours and explicitly estimated cupola, caps and roof ridges";
  outlines.userData = { textureFree: true, cartographicOutline: true };
  const members = justicePalaceV183Boxes(source.boxes);
  members.name = "Thin facade windows, pale frames and open tower members";
  root.add(outlines, members, createCharlottenburgCupolaV183());
  const roofPositions = new Float32Array(source.roofTriangles.length * 9);
  const roofColors = new Float32Array(roofPositions.length);
  const normal = new Vector3(), a = new Vector3(), b = new Vector3(), light = new Vector3(-.5, 1, .5).normalize();
  source.roofTriangles.forEach((r, i) => {
    a.set(r[3]-r[0], r[4]-r[1], r[5]-r[2]); b.set(r[6]-r[0], r[7]-r[1], r[8]-r[2]);
    normal.crossVectors(a, b).normalize(); if (normal.y < 0) normal.negate();
    color.setHex(r[9]).multiplyScalar(.7 + .3 * Math.max(0, normal.dot(light)));
    for (let j = 0; j < 9; j++) roofPositions[i * 9 + j] = r[j];
    for (let j = 0; j < 3; j++) color.toArray(roofColors, i * 9 + j * 3);
  });
  const roofGeometry = new BufferGeometry();
  roofGeometry.setAttribute("position", new BufferAttribute(roofPositions, 3));
  roofGeometry.setAttribute("color", new BufferAttribute(roofColors, 3));
  roofGeometry.computeVertexNormals(); roofGeometry.computeBoundingBox(); roofGeometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, flatShading: true, roughness: .96 });
  const roofs = new Mesh(roofGeometry, day);
  roofs.name = "Courthouse hollow upper roof skins on exact source footprints";
  roofs.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, surfaceOnly: true,
    hiddenSolidInfill: false, estimatedShell: true, sourceProfiles: source.estimatedRoofSkins };
  root.add(roofs);
  return freezeStaticSceneTransforms(root);
}
