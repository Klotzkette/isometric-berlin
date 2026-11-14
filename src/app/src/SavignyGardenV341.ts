import { BoxGeometry, Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial } from "three";
import data from "./data/savignyGardenV341.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

const CONTROL = 1029867067;
const PALETTE = [0x546d43, 0x607b4b, 0x748758];
export function savignyGardenSourceV341(publicRealm: unknown): boolean {
  let hash = 2166136261;
  for (const c of JSON.stringify(publicRealm)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  return hash === CONTROL;
}

/** Only the remaining gaps in two mapped shrub areas, with separate actual
 * ground datums. All crowns fit their source polygons clear of roads and bodies. */
export function createSavignyGardenV341(publicRealm: unknown, native = false): Group | null {
  if (!savignyGardenSourceV341(publicRealm)) return null;
  const root = new Group();
  root.name = "Savignyplatz — mapped northern shrub gardens v341";
  root.userData = { savignyGardenV341: true, fullStaticDetailOnTouch: true, textureFree: true, blockNative: native, keepInMinecraft: native, sourceGeometryRetained: true };
  const day = new MeshBasicMaterial({color:0xffffff});
  const night = new MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true});
  const geometry = native ? new BoxGeometry() : new IcosahedronGeometry(1, 0);
  geometry.deleteAttribute("uv");
  const count = data.patches.reduce((n, p) => n + p.anchors.length * 3, 0);
  const mesh = new InstancedMesh(geometry, day, count), matrix = new Matrix4(), color = new Color();
  let instance = 0;
  for (const patch of data.patches) for (const [x,z,drawnY,nativeY,h,tone] of patch.anchors) {
    const y = native ? nativeY : drawnY;
    for (let lobe = 0; lobe < 3; lobe++) {
      const dx = (lobe - 1) * .18, dz = lobe === 1 ? .12 : -.08;
      const top = h * (lobe === 1 ? 1 : .76);
      if (native) matrix.makeScale(.46, top, .48).setPosition(x+dx,y+top/2,z+dz);
      else matrix.makeScale(.31,top/2,.33).setPosition(x+dx,y+top/2,z+dz);
      mesh.setMatrixAt(instance,matrix);mesh.setColorAt(instance++,color.setHex(PALETTE[(tone+lobe)%3]));
    }
  }
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.name = "Two exact OSM scrub patches: source-contained low foliage";
  mesh.userData = { dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,nativeMinecraft:native,fullStaticDetailOnTouch:true };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
