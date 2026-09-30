import { Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { LEIPZIGER_MALL_PASSAGE_PART, LEIPZIGER_SOURCE_GROUP_NAME, LEIPZIGER_SOURCE_PROFILES, leipzigerTranslatedPart } from "./leipzigerPlatzSourceProfile";

const TONES: Record<string, [number, number]> = {
  "Mall of Berlin west": [0xc6c2b5, 0x87917e],
  "Mall of Berlin central": [0xd3cbba, 0x899281],
  "Mall of Berlin east": [0xdfd9c9, 0x949780],
  "Voßpalais, Voßstraße 33": [0xa66b54, 0x716a61],
  "Mosse-Palais, Leipziger Platz 15": [0xc9baa0, 0x767d77],
  "Quartier Leipziger Platz 1–3": [0xc7c1b1, 0x747c79],
};

/** The official three roof planes are glass, not a solid opaque building cap. */
export function createLeipzigerMallPassageGlass(): Mesh {
  const original = LEIPZIGER_MALL_PASSAGE_PART;
  const eave = Math.min(...original.surfaces.filter(s => s.kind === "RoofSurface").flatMap(s => s.rings.flat().map(p => p[1])));
  const glass = sourceMesh([{ ...original, surfaces: original.surfaces.filter(surface =>
    surface.kind === "RoofSurface" || surface.rings.flat().every(p => p[1] >= eave - .001),
  ) }], { name: "Mall of Berlin transparent barrel passage roof", wall: 0xa7c1c0, roof: 0xa7c1c0 });
  [glass.userData.dayMaterial, glass.userData.nightMaterial].forEach(material => material.dispose());
  const dayGlass = new MeshBasicMaterial({ color: 0xa7c1c0, transparent: true, opacity: .28, depthWrite: false, side: DoubleSide });
  const nightGlass = new MeshStandardMaterial({ color: 0x9bbaba, transparent: true, opacity: .25, depthWrite: false, side: DoubleSide, roughness: .36 });
  glass.material = dayGlass;
  glass.name = "Mall of Berlin transparent barrel passage roof";
  glass.userData = { dayMaterial: dayGlass, nightMaterial: nightGlass, textureFree: true,
    sourceOsmRoof: "380104431", sourceLod2Part: original.id, sourceParentId: original.id,
    openCoveredPassage: true, sourceRoofPlanesUnchanged: true,
    archivedFalseClosure: "Official closure below the roof retained in source JSON; open Piazza confirmed by Tchoban Voss and OSM covered passage" };
  return glass;
}

/** Each original wall, pitched roof, inner court and setback remains represented. */
export function createLeipzigerPlatzSourceShells(): Group {
  const root = new Group();
  root.name = LEIPZIGER_SOURCE_GROUP_NAME;
  root.userData = { textureFree: true, exactSourceSheets: true, replacesOwnPrismsOnly: true };
  for (const profile of LEIPZIGER_SOURCE_PROFILES) {
    if (profile.parent_id === "DEBE00YY1mc0004E") { root.add(createLeipzigerMallPassageGlass()); continue; }
    const [wall, roof] = TONES[profile.name] ?? [0xcec6b4, 0x78817c];
    const parts = profile.parts.map(part => leipzigerTranslatedPart(part, profile.display_y_translation_m));
    const mesh = sourceMesh(parts, { wall, roof, name: profile.name });
    if (profile.parent_id === "DEBE01YYK0000Ao8") {
      // Only the surviving street face is red sandstone. The later two-step
      // upper/rear volume is pale render; source positions stay unchanged.
      const position = mesh.geometry.getAttribute("position");
      const colors = mesh.geometry.getAttribute("color");
      const pale = new Color(0xcac7b8);
      for (let i = 0; i < position.count; i += 3) {
        const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
        const x = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
        const z = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
        const outward = (x - 675.561) * -.2796 + (z - 892.023) * -.9601;
        if (Math.abs(mesh.geometry.getAttribute("normal").getY(i)) > .5) continue;
        if (y < 25.45 && outward > -.45) continue;
        for (let j = 0; j < 3; j++) colors.setXYZ(i + j, pale.r, pale.g, pale.b);
      }
      colors.needsUpdate = true;
    }
    mesh.userData.sourceParentId = profile.parent_id;
    mesh.userData.displayYTranslation = profile.display_y_translation_m;
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
