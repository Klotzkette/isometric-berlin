import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import data from "./data/weddingSitesV210.json";
import envelopes from "./data/weddingSitesV210Envelopes.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const WEDDING_SITES_V210_CAMERAS = {
  erika: { position: [65, 125, -1910], target: [-56, 12, -2070], spanM: 215 },
  bayer: { position: [125, 230, -2020], target: [-285, 21, -2320], spanM: 700 },
};
const materialPair = () => ({
  day: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
  night: new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .87 }),
});
function rootGroup(native: boolean, required: boolean): Group {
  const root = new Group();
  root.name = `Wedding stadium and source-bound Bayer campus v210${required ? " required hall roof supplement" : " exterior detail"}${native ? " native" : ""}`;
  root.userData = { weddingSitesV210: true, sourceGeometryRetained: true, additiveOnly: true,
    fullStaticDetailOnTouch: true, textureFree: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, requiredUpperHall: required, newScopeArea: 0,
    sourceReceipt: "wedding-sites-v210-source.json", oldSourceBodiesSuppressed: 0 };
  return root;
}
function instances(rows: (number | string)[][], native: boolean, name: string): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const normals = geometry.getAttribute("normal"), shades = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const s = normals.getY(i) > .5 ? 1 : normals.getX(i) > .5 ? .84 : .94;
    shades.set([s, s, s], i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(shades, 3));
  const { day, night } = materialPair(), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), p = new Vector3(), size = new Vector3(), q = new Quaternion(), color = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(+r[3], +r[4], +r[5]).setPosition(+r[0], +r[1], +r[2]);
    else matrix.compose(p.set(+r[0], +r[1], +r[2]), q.set(+r[6], +r[7], +r[8], +r[9]).normalize(), size.set(+r[3], +r[4], +r[5]));
    matrix.toArray(matrices, i * 16); color.setHex(+r[native ? 6 : 10]).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.name = name;
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: native, blockNative: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}
/** Required additive upper hall: original low LoD2/core bodies remain in place. */
export function createWeddingSitesEnvelopesV210(native = false): Group {
  const root = rootGroup(native, true);
  if (native) root.add(instances(envelopes.blocks, true, "Erika Hess independent block roof and wall skin"));
  else {
    const count = envelopes.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
    const positions = new Float32Array(count), colors = new Float32Array(count), color = new Color(); let cursor = 0;
    for (const s of envelopes.surfaces) {
      color.setHex(s.color);
      for (const t of s.triangles) for (const p of t) { positions.set(p, cursor); color.toArray(colors, cursor); cursor += 3; }
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const { day, night } = materialPair(), mesh = new Mesh(geometry, day);
    mesh.name = "Erika Hess bDOM roof over complete retained source ring";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true }; root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
/** Additive, bounded public architecture; identical detail on touch and desktop. */
export function createWeddingSitesV210(native = false): Group {
  const root = rootGroup(native, false), rows = native ? data.blocks : data.boxes;
  for (const site of data.sites)
    root.add(instances(rows.filter(r => r[native ? 7 : 11] === site), native,
      site === "erika" ? "Erika Hess five concrete pylons, glazed hall and mapped rink" : "Bayer Schering retained source-wall facade rhythm"));
  return freezeStaticSceneTransforms(root);
}
