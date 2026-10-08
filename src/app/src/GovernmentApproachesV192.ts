import { BoxGeometry, Color, InstancedMesh, MeshStandardMaterial, Object3D } from "three";
import { HAUPTBAHNHOF_ACCESS } from "./HauptbahnhofAccessProfile";
import { MINECRAFT_ARCHITECTURAL_BLOCKS as BLOCK } from "./visual-modes/minecraft/palette";

type Point = [number, number, number];
export type ApproachMemberV192 = {
  position: Point;
  size: Point;
  color: number;
  role: string;
};

/** Small local-frame additions only. The existing metric station/cube owns
 * position, rotation, height and every opening. Member sections are display
 * estimates from the retained free references, not a construction survey. */
export const GOVERNMENT_APPROACHES_V192 = {
  evidence: "geo_data/regierungsviertel/government-approaches-v192-evidence.json",
  stationReference: "File:Berlin Hauptbahnhof, Ansicht vom Washingtonplatz.jpg",
  loggiaReferences: [
    "File:A Schultes Bundeskanzleramt side detail1.JPG",
    "File:B Bundeskanzleramt 2.JPG",
  ],
} as const;

/** Drawn entrance leaves already retract beside six genuine clear apertures.
 * These jambs remain outside those apertures; no threshold crosses the route. */
export function hauptbahnhofPortalMembersV192(facadeZ: number): ApproachMemberV192[] {
  const p = HAUPTBAHNHOF_ACCESS;
  const z = facadeZ + Math.sign(facadeZ) * 0.31;
  const members: ApproachMemberV192[] = [];
  for (const x of p.doorCentresLocalX) {
    members.push({
      role: "Hauptbahnhof v192 sliding-door header",
      position: [x, p.doorHeightM + 0.17, z],
      size: [p.doorBayWidthM, 0.24, 0.28], color: 0x8b9da0,
    });
    for (const side of [-1, 1]) members.push({
      role: "Hauptbahnhof v192 slim open-portal jamb",
      position: [x + side * (p.doorClearWidthM / 2 + 0.06), p.doorHeightM / 2, z],
      size: [0.08, p.doorHeightM, 0.14], color: 0x8b9da0,
    });
  }
  return members;
}

/** Minecraft keeps its one broad opening per gable, not six small smooth
 * doorways. Chunky side trims sit inside the existing closed side bays. */
export function hauptbahnhofNativePortalMembersV192(
  facadeZ: number, floorY: number, clearHeight: number, clearHalfWidth: number,
): ApproachMemberV192[] {
  const z = facadeZ + Math.sign(facadeZ) * 1.1;
  const members: ApproachMemberV192[] = [{
    role: "Hauptbahnhof v192 native portal lintel",
    position: [0, clearHeight + 0.45, z],
    size: [clearHalfWidth * 2 + 1.2, 0.65, 0.55], color: BLOCK.silver,
  }];
  for (const side of [-1, 1]) members.push({
    role: "Hauptbahnhof v192 native portal side trim",
    position: [side * (clearHalfWidth + 0.6), (clearHeight + floorY) / 2, z],
    size: [0.55, clearHeight - floorY, 0.55], color: BLOCK.silver,
  });
  return members;
}

/** Additional thin rails and shallow louvres fit inside the already displayed
 * semicircular loggias. Existing columns, capitals, tracery and rails remain.
 * The photo shows the louvred sill and returned rail ends; subdivision sizes
 * are conservative display estimates tied to the old balcony's 29 m span. */
export function chancelleryLoggiaMembersV192(
  cubeX: number, cubeZ: number, cubeWidth: number, native = false,
): ApproachMemberV192[] {
  const members: ApproachMemberV192[] = [];
  for (const side of [-1, 1]) {
    const x = cubeX + side * (cubeWidth / 2 + (native ? 1.45 : 0.43));
    for (const y of native ? [11.4, 12.4] : [11.3, 12.2]) members.push({
      role: native ? "Chancellery v192 native balcony bar" : "Chancellery v192 balcony intermediate rail",
      position: [x, y, cubeZ],
      size: native ? [0.35, 0.28, 28] : [0.055, 0.055, 29], color: native ? BLOCK.iron : 0x8f9c9b,
    });
    // Only the visible sill above the existing 10.5 m spring line is detailed;
    // no speculative new opening is cut into the measured masonry beneath it.
    for (const y of native ? [10.65] : [10.59, 10.77, 10.95]) members.push({
      role: native ? "Chancellery v192 native louvred sill" : "Chancellery v192 open louvred sill",
      position: [x - side * (native ? 0 : 0.08), y, cubeZ],
      size: native ? [0.45, 0.3, 28] : [0.19, 0.065, 28.8], color: native ? BLOCK.deepRecess : 0x6c807f,
    });
    if (!native) for (const end of [-1, 1]) for (const y of [11.3, 11.75, 12.2, 12.65]) members.push({
      role: "Chancellery v192 balcony rail return",
      position: [x - side * 0.82, y, cubeZ + end * 14.5],
      size: [1.64, 0.055, 0.055], color: 0x8f9c9b,
    });
  }
  return members;
}

/** One material/box buffer per local model addition. Native members are instead
 * appended to the established block plans by MinecraftArchitecturalLandmarks. */
export function createApproachMemberBatchV192(name: string, members: ApproachMemberV192[]): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.34 });
  const mesh = new InstancedMesh(geometry, material, members.length);
  const transform = new Object3D();
  for (const [i, member] of members.entries()) {
    transform.position.set(...member.position);
    transform.scale.set(...member.size);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
    mesh.setColorAt(i, new Color(member.color));
  }
  mesh.name = name;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.userData.keepInMinecraft = false;
  mesh.userData.governmentApproachesV192 = true;
  mesh.userData.evidence = GOVERNMENT_APPROACHES_V192.evidence;
  return mesh;
}
