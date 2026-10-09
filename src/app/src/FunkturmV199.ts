import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import drawn from "./data/funkturmV199.json";
import native from "./data/funkturmV199Native.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Fittings = { name: string; boxes: number[][]; rods: number[][]; positions: number[]; colors: number[]; indices: number[] };

/** Missing fittings around the unchanged v179/v182/v187 tower, no second shaft. */
export function createFunkturmV199(minecraft = false): Group {
  const root = new Group();
  root.name = "Funkturm bearings, stairs and platform fittings v199";
  root.userData = { funkturmV199: true, additiveOnly: true, textureFree: true, blockNative: minecraft, keepInMinecraft: minecraft, fullStaticDetailOnTouch: true };
  const groups: readonly Fittings[] = minecraft ? native.groups : drawn.groups;
  const cube = new BoxGeometry(1, 1, 1); cube.deleteAttribute("uv");
  cube.computeBoundingBox(); cube.computeBoundingSphere();
  const matrix = new Matrix4(), tint = new Color(), a = new Vector3(), b = new Vector3(), direction = new Vector3(), up = new Vector3(0, 1, 0), scale = new Vector3(), rotation = new Quaternion();
  for (const data of groups) {
    const group = new Group(); group.name = data.name;
    const count = data.boxes.length + data.rods.length;
    if (count) {
      const day = new MeshBasicMaterial({ color: 0xffffff });
      const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .78, flatShading: true });
      const mesh = new InstancedMesh(cube, day, 0);
      const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
      data.boxes.forEach((r, i) => {
        matrix.makeScale(r[3], r[4], r[5]); matrix.setPosition(r[0], r[1], r[2]);
        matrix.toArray(matrices, i * 16); tint.setHex(r[6]).toArray(colors, i * 3);
      });
      data.rods.forEach((r, i) => {
        a.fromArray(r); b.fromArray(r, 3); direction.subVectors(b, a);
        const length = direction.length(); rotation.setFromUnitVectors(up, direction.normalize());
        matrix.compose(a.add(b).multiplyScalar(.5), rotation, scale.set(r[6], length, r[6]));
        matrix.toArray(matrices, (data.boxes.length + i) * 16); tint.setHex(r[7]).toArray(colors, (data.boxes.length + i) * 3);
      });
      mesh.count = count; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      mesh.name = `${data.name}: ${minecraft ? "independent orthogonal fittings" : "small steel and concrete members"}`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: minecraft, keepInMinecraft: minecraft };
      group.add(mesh);
    }
    if (data.indices.length) {
      const geometry = new BufferGeometry(), colors = new Float32Array(data.colors.length * 3);
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(data.positions), 3));
      data.colors.forEach((c, i) => tint.setHex(c).toArray(colors, i * 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      geometry.setIndex(data.indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const night = new MeshStandardMaterial({ vertexColors: true, roughness: .76, side: DoubleSide, flatShading: true });
      const mesh = new Mesh(geometry, day); mesh.name = `${data.name}: porcelain and inclined fascia`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: false, keepInMinecraft: false };
      group.add(mesh);
    }
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}
