import { BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Color, Float32BufferAttribute, type BufferGeometry } from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import soho from "./data/historicArchitectureV378Soho.json";

export function createSohoHouseFrontV378(native: boolean): Mesh {
  const facade = justicePalaceV183Boxes(native ? soho.minecraft : soho.drawn, native);
  facade.name = "Kredit-Warenhaus Jonaß – Torstraße und Prenzlauer Allee";
  facade.userData.historicArchitectureV378 = "kaufhaus-jonass";
  return facade;
}

/** The photographed entrance faces the park path on the east. Its footprint is
 * independently identified by the public map, survey wall and TrueDOP steps. */
export function createArchenholdEntranceV378(native: boolean): Group {
  const geometry: BufferGeometry[] = [];
  const face = native ? 7060.18 : 7059.77;
  const mid = 3828.40;
  const clockHeight = 13.36;
  const beige = 0xdad2bd, edge = 0xbcb5a4, glass = 0x424c4c, steel = 0x58656a;
  function add(g: BufferGeometry, x: number, y: number, z: number, colour: number): void {
    g.translate(x, y, z);
    const c = new Color(colour);
    const rgb = new Float32Array(g.getAttribute("position").count * 3);
    for (let i = 0; i < rgb.length; i += 3) c.toArray(rgb, i);
    g.setAttribute("color", new Float32BufferAttribute(rgb, 3));
    geometry.push(g);
  }
  function box(x: number, y: number, z: number, dx: number, dy: number, dz: number, colour: number): void {
    add(new BoxGeometry(dx, dy, dz), x, y, z, colour);
  }
  // Three tall glazed bays under a projecting horizontal entablature.
  for (const offset of [-2.20, 0, 2.20]) {
    box(face, 5.42, mid + offset, .16, 4.48, 1.67, glass);
    box(face + .20, 7.40, mid + offset, .12, .16, 1.69, edge);
    box(face - .10, 10.58, mid + offset, .21, .96, 1.22, glass);
  }
  for (const offset of [-3.27, -1.09, 1.09, 3.27]) {
    box(face + .33, 5.45, mid + offset, .69, 4.51, .48, beige);
  }
  box(face + .23, 7.88, mid, .95, .33, 7.38, edge);
  box(face + .17, 8.12, mid, .88, .25, 7.50, beige);
  box(face - .02, 12.91, mid, .54, .22, 7.35, edge);
  const clockX = face + .34;
  if (native) {
    const cell = .16;
    for (let y = -5; y <= 5; y++) for (let z = -5; z <= 5; z++) {
      const r = Math.hypot(y, z);
      if (r > 5.15) continue;
      const hand = (z === 0 && y >= 0 && y < 4) || (z === 1 && y < 1 && y >= -2);
      box(clockX, clockHeight + y * cell, mid + z * cell, .18, cell, cell,
        r > 4.1 || hand ? steel : 0x96b8c2);
    }
  } else {
    const disk = (radius: number, depth: number, x: number, color: number) =>
      add(new CylinderGeometry(radius, radius, depth, 32).rotateZ(Math.PI / 2), x, clockHeight, mid, color);
    disk(.83, .18, clockX, steel);
    disk(.72, .06, clockX + .12, 0x96b8c2);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const g = new BoxGeometry(.07, .135, .035).rotateX(angle);
      add(g, clockX + .17, clockHeight + .598 * Math.cos(angle), mid + .598 * Math.sin(angle), steel);
    }
    for (const [angle, length] of [[.26, .47], [3.47, .35]]) {
      const g = new BoxGeometry(.07, length, .062).rotateX(angle);
      add(g, clockX + .19, clockHeight + Math.cos(angle) * length / 2,
        mid + Math.sin(angle) * length / 2, 0x31434a);
    }
  }
  // The small group is entirely static and shares one draw call.
  const merged = mergeGeometries(geometry)!;
  for (const g of geometry) g.dispose();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, roughness: .82, side: DoubleSide });
  const part = new Mesh(merged, day);
  part.name = "Archenhold-Sternwarte – Ostportal und Fassadenuhr";
  part.userData = { dayMaterial: day, nightMaterial: night, keepInMinecraft: native, historicArchitectureV378: "archenhold-sternwarte" };
  const root = new Group();
  root.add(part);
  root.userData.historicArchitectureV378 = "archenhold-sternwarte";
  return freezeStaticSceneTransforms(root);
}
