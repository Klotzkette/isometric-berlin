import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineDashedMaterial, LineSegments } from "three";
import data from "./data/tegelMotorwayV194.json";

/** Sparse cartographic roads: full source bends, no invented motorway grade. */
export function createTegelMotorwayV194(native = false): Group {
  const root = new Group();
  root.name = "A111 through Tegel — source outlines v194";
  root.userData = { nativeMinecraft: native, textureFree: true, outlineOnly: true };
  for (const kind of ["surface", "tunnel"] as const) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(data.positions[kind], 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const options = { color: kind === "tunnel" ? 0x697a76 : 0x697368, fog: false };
    const day = kind === "tunnel" ? new LineDashedMaterial({ ...options, dashSize: 7, gapSize: 5 }) : new LineBasicMaterial(options);
    const night = kind === "tunnel" ? new LineDashedMaterial({ ...options, color: 0x829398, dashSize: 7, gapSize: 5 }) : new LineBasicMaterial({ ...options, color: 0x9caaa3 });
    const lines = new LineSegments(geometry, day);
    lines.name = `A111 ${kind} outlines`;
    lines.userData = { dayMaterial: day, nightMaterial: night, sourceGrade: "cartographic projection" };
    if (kind === "tunnel") lines.computeLineDistances();
    root.add(lines);
  }
  root.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  return root;
}
