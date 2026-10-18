import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import data from "./data/monbijouV231.json";
import nativeData from "./data/monbijouV231Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Complete exact-plan bridge replacement and individual park bench owners.
 * No textures, device-specific quality cuts, animations or retained source arrays. */
export function createMonbijouV231(native = false): Group {
  const root = new Group(); root.name = `Monbijou bridges and park v231${native ? " native" : ""}`;
  root.userData = { monbijouV231: true, requiredBeforeNavigation: true, textureFree: true,
    fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  const metadata = (key: string) => ({ monbijouV231: true, siteKey: key, requiredBeforeNavigation: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native, textureFree: true });
  if (native) {
    for (const site of nativeData.sites) {
      for (const [name, rows] of [["source footprint body", site.body], ["orthogonal fittings", site.fittings]] as const) {
        if (!rows.length) continue;
        const mesh = justicePalaceV183Boxes(rows, true);
        mesh.name = `Monbijou ${site.key} ${name}`;
        Object.assign(mesh.userData, metadata(site.key)); root.add(mesh);
      }
    }
  } else {
    const tint = new Color();
    for (const site of data.sites) {
      if (site.vertices.length) {
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(Float32Array.from(site.vertices), 3));
        const colors = new Float32Array(site.colors.length * 3);
        site.colors.forEach((color, i) => tint.setHex(color).toArray(colors, i * 3));
        g.setAttribute("color", new BufferAttribute(colors, 3));
        g.setIndex(site.indices); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
        const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
        const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .88 });
        const mesh = new Mesh(g, day); mesh.name = `Monbijou ${site.key} complete bridge envelope`;
        mesh.userData = { ...metadata(site.key), dayMaterial: day, nightMaterial: night };
        root.add(mesh);
      }
      const mesh = justicePalaceV183Boxes(site.boxes);
      mesh.name = `Monbijou ${site.key} masonry and furniture`;
      Object.assign(mesh.userData, metadata(site.key)); root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
