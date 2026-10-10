import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineDashedMaterial, LineSegments } from "three";
import data from "./data/westernMotorwaysV205.json";
import { terrainGroundAt } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Existing source bends and display grades; paired route edges never imply an invented viaduct. */
export function createWesternMotorwaysV205(native = false): Group {
  const root = new Group(); root.name = "Western A100 and A115 source carriageway outlines v205";
  root.userData = { textureFree: true, additiveOnly: true, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, fullStaticDetailOnTouch: true, cartographicOverlay: true };
  for (const batch of data.groups) {
    const values = new Float32Array(batch.positions);
    for (let i = 0; i < values.length; i += 3) values[i + 1] += terrainGroundAt(values[i], values[i + 2], 3, false) - 3;
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(values, 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const tunnel = batch.kind === "tunnel";
    const day = tunnel ? new LineDashedMaterial({ color: 0x788780, dashSize: 8, gapSize: 6, fog: false }) : new LineBasicMaterial({ color: 0x879387, fog: false });
    const night = tunnel ? new LineDashedMaterial({ color: 0x9badab, dashSize: 8, gapSize: 6, fog: false }) : new LineBasicMaterial({ color: 0xb2bbae, fog: false });
    const lines = new LineSegments(geometry, day); lines.name = `Western motorway ${batch.key}`;
    lines.userData = { dayMaterial: day, nightMaterial: night, sourceGrade: "unchanged cartographic projection", textureFree: true };
    if (tunnel) lines.computeLineDistances(); root.add(lines);
  }
  return freezeStaticSceneTransforms(root);
}
