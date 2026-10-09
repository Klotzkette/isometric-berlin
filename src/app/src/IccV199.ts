import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import drawn from "./data/iccV199.json";
import native from "./data/iccV199Native.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Site = { key: string; owners: string[]; boxes: number[][]; rods: number[][]; positions: number[]; indices: number[]; colors: number[] };

/** Full measured ICC shells plus bounded texture-free facade interpretation. */
export function createIccV199(minecraft = false): Group {
  const root = new Group();
  root.name = "ICC Berlin measured shell and high-tech facade v199";
  root.userData = { iccV199: true, textureFree: true, fullStaticDetailOnTouch: true, blockNative: minecraft, keepInMinecraft: minecraft };
  const sites: readonly Site[] = minecraft ? native.sites : drawn.sites;
  const cube = new BoxGeometry(1, 1, 1); cube.deleteAttribute("uv");
  cube.computeBoundingBox(); cube.computeBoundingSphere();
  const matrix = new Matrix4(), color = new Color(), position = new Vector3(), scale = new Vector3(), rotation = new Quaternion(), direction = new Vector3(), up = new Vector3(0, 1, 0);
  for (const site of sites) {
    const group = new Group(); group.name = site.key;
    group.userData = { sourceOwners: site.owners, independentCulling: true, blockNative: minecraft, keepInMinecraft: minecraft };
    const count = site.boxes.length + site.rods.length;
    if (count) {
      const day = new MeshBasicMaterial({ color: 0xffffff });
      const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .86, flatShading: true });
      const mesh = new InstancedMesh(cube, day, 0);
      const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
      site.boxes.forEach((r, i) => {
        if (minecraft) matrix.makeScale(r[3], r[4], r[5]);
        else { matrix.makeRotationY(r[6]); matrix.scale(scale.set(r[3], r[4], r[5])); }
        matrix.setPosition(r[0], r[1], r[2]); matrix.toArray(matrices, i * 16);
        color.setHex(r[minecraft ? 6 : 7]).toArray(colors, i * 3);
      });
      site.rods.forEach((r, i) => {
        position.fromArray(r); direction.set(r[3] - r[0], r[4] - r[1], r[5] - r[2]);
        const length = direction.length(); position.addScaledVector(direction, .5);
        rotation.setFromUnitVectors(up, direction.normalize());
        matrix.compose(position, rotation, scale.set(r[6], length, r[6]));
        matrix.toArray(matrices, (site.boxes.length + i) * 16);
        color.setHex(r[7]).toArray(colors, (site.boxes.length + i) * 3);
      });
      mesh.count = count;
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      mesh.name = `${site.key}: ${minecraft ? "separate orthogonal block interpretation" : "bounded relief and steel members"}`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: minecraft, keepInMinecraft: minecraft };
      group.add(mesh);
    }
    if (site.indices.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(site.positions), 3));
      const colors = new Float32Array(site.colors.length * 3);
      site.colors.forEach((value, i) => {
        color.setHex(value);
        if (site.key.includes("source water")) color.setRGB(Math.round(color.r * 255) / 255, Math.round(color.g * 255) / 255, Math.round(color.b * 255) / 255);
        color.toArray(colors, i * 3);
      });
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      geometry.setIndex(new BufferAttribute(new Uint16Array(site.indices), 1));
      geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1 });
      const day = minecraft ? night : new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const mesh = new Mesh(geometry, day);
      mesh.name = `${site.key}: complete mapped bridge deck`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: minecraft, keepInMinecraft: minecraft };
      group.add(mesh);
    }
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}
