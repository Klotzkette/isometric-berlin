import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import { centralTheatreRowsV274, CENTRAL_THEATRES_V274_COUNTS } from "./palastStageV274";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const CENTRAL_THEATRES_V274_GROUP = "Central theatre stage roof architecture v274";

/** Additive roof fittings only. Original complete theatre envelopes and all
 * facade details remain; the separate Palast transaction runs inside its owner. */
export function createCentralTheatresV274(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = CENTRAL_THEATRES_V274_GROUP + (native ? " native" : "");
  const rows = centralTheatreRowsV274(native, "other"), count = rows.length / 8;
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const matrix = new Matrix4(), size = new Vector3(), color = new Color();
  for (let i = 0; i < count; i++) {
    const k = i * 8;
    matrix.makeRotationY(rows[k + 6]); matrix.scale(size.set(rows[k + 3], rows[k + 4], rows[k + 5]));
    matrix.setPosition(rows[k], rows[k + 1], rows[k + 2]); matrix.toArray(matrices, i * 16);
    color.setHex(rows[k + 7]).toArray(colors, i * 3);
  }
  const geometry = new BoxGeometry(); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0); mesh.count = count;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = "DT and BE roof monitors, Boell atrium frame, Volksbuehne stage parapet and smoke vents";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  root.userData = { textureFree: true, sourceGeometryRetained: true, fullStaticDetailOnTouch: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native, constructionOnly: true,
    noHiddenSolidInfill: true, renderBudget: CENTRAL_THEATRES_V274_COUNTS,
    sourceReceipt: "central-theatres-v274-evidence.json.gz",
    interpretation: "Source-bound recognition fittings from official orthophotos; fitting dimensions are estimates, not a facade survey" };
  return freezeStaticSceneTransforms(root);
}
