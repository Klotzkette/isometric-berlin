import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, Group,
  InstancedBufferAttribute, InstancedMesh, LineBasicMaterial, LineSegments,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import source from "./data/cityRecognitionV182.json";
import { keepCivicBoxV182V210, keepCivicSegmentV182V210 } from "./westCivicPreviousV210";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const CITY_RECOGNITION_V182_GROUP = "Measured civic and theatre recognition v182";
export const CITY_RECOGNITION_V182_NATIVE_GROUP = "Native civic and theatre recognition v182";

/** A small additive skin. Earlier building owners, courts and detail stay intact. */
export function createCityRecognitionV182(minecraft = false, includeSupersededEstimates = true): Group {
  const root = new Group();
  root.name = minecraft ? CITY_RECOGNITION_V182_NATIVE_GROUP : CITY_RECOGNITION_V182_GROUP;
  root.userData = {
    textureFree: true, additiveOnly: true, nativeMinecraft: minecraft,
    keepInMinecraft: minecraft, blockNative: minecraft,
    sourceParents: source.features.map(f => f.parentId),
    sourceConflicts: source.sourceConflicts,
    facadeStatus: "Thin procedural subdivisions on official source wall planes; not a facade survey",
  };
  const segments = includeSupersededEstimates ? source.segments : source.segments.filter(keepCivicSegmentV182V210);
  const boxes = includeSupersededEstimates ? source.boxes : source.boxes.filter(keepCivicBoxV182V210);
  const positions = new Float32Array(segments.length * 6);
  const colors = new Float32Array(positions.length);
  const color = new Color();
  segments.forEach((s, i) => {
    positions.set(s.slice(0, 6), i * 6);
    color.setHex(s[6]);
    color.toArray(colors, i * 6); color.toArray(colors, i * 6 + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const lines = new LineSegments(geometry, new LineBasicMaterial({ vertexColors: true, depthWrite: false }));
  lines.name = "Measured civic roof lines, floor registers and secondary Funkturm bracing";
  lines.userData = { textureFree: true, cartographicOutline: true, keepInMinecraft: minecraft };
  root.add(lines);

  const cube = new BoxGeometry(1, 1, 1); cube.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .82, flatShading: true });
  const detail = new InstancedMesh(cube, day, 0), matrix = new Matrix4();
  const matrices = new Float32Array(boxes.length * 16);
  const tints = new Float32Array(boxes.length * 3);
  boxes.forEach((r, i) => {
    const c = Math.abs(Math.cos(r[6])), s = Math.abs(Math.sin(r[6]));
    if (minecraft) {
      // Only a facade skin: axis-aligned native panels, never hidden solid fill.
      matrix.makeScale(Math.max(.16, r[3] * c + r[5] * s), r[4], Math.max(.16, r[3] * s + r[5] * c));
    } else {
      matrix.makeRotationY(r[6]); matrix.scale(new Vector3(r[3], r[4], r[5]));
    }
    matrix.setPosition(r[0], r[1], r[2]); matrix.toArray(matrices, i * 16);
    color.setHex(r[7]).toArray(tints, i * 3);
  });
  detail.count = boxes.length;
  detail.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  detail.instanceColor = new InstancedBufferAttribute(tints, 3);
  detail.name = "Bounded facade windows, blue glass cube stack and Funkturm decks";
  detail.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: minecraft };
  detail.computeBoundingBox(); detail.computeBoundingSphere();
  root.add(detail);
  return freezeStaticSceneTransforms(root);
}
