import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, EdgesGeometry, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Vector3,
} from "three";
import source from "./data/grunewaldLandmarksV190.json";
import native from "./data/grunewaldLandmarksV190Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Surface = { triangles: number[][][]; color: number };
type Site = { key: string; name: string; owners: string[]; boxes: number[][]; surfaces?: Surface[] };

function shell(surfaces: readonly Surface[]): Mesh {
  const count = surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
  const positions = new Float32Array(count), colors = new Float32Array(count);
  const color = new Color(), a = new Vector3(), b = new Vector3(), normal = new Vector3();
  let offset = 0;
  for (const surface of surfaces) for (const triangle of surface.triangles) {
    a.fromArray(triangle[1]).sub(b.fromArray(triangle[0]));
    b.fromArray(triangle[2]).sub(normal.fromArray(triangle[0]));
    normal.crossVectors(a, b).normalize();
    const light = Math.abs(normal.y) > .5 ? 1 : normal.x > .5 ? .89 : normal.z > .5 ? .93 : .98;
    color.setHex(surface.color).multiplyScalar(light);
    for (const point of triangle) {
      positions.set(point, offset); color.toArray(colors, offset); offset += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .87, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.userData = { dayMaterial: day, nightMaterial: night, fullSourceShell: true, textureFree: true };
  return mesh;
}

/** Exact new owners, independent site culling and one active representation. */
export function createGrunewaldLandmarksV190(minecraft = false): Group {
  const root = new Group();
  root.name = "Grunewald: Brücke-Museum and Karlsberg tower v190";
  root.userData = {
    grunewaldLandmarksV190: true, textureFree: true, fullStaticDetailOnTouch: true,
    sourceGeometryRetained: true, blockNative: minecraft, keepInMinecraft: minecraft,
    proceduralRecognitionDetails: true,
  };
  const sites: readonly Site[] = minecraft ? native.sites : source.sites;
  for (const site of sites) {
    const group = new Group(); group.name = site.name;
    group.userData = { siteKey: site.key, sourceOwners: site.owners };
    if (!minecraft && site.surfaces?.length) {
      const body = shell(site.surfaces); body.name = `${site.name}: complete measured walls and roofs`;
      group.add(body);
      const edges = new LineSegments(new EdgesGeometry(body.geometry, 20),
        new LineBasicMaterial({ color: 0x525C54, transparent: true, opacity: .40, depthWrite: false }));
      edges.name = `${site.name}: measured eaves, roof folds and courtyard edges`;
      edges.userData.textureFree = true; group.add(edges);
    }
    if (site.boxes.length) {
      const boxes = justicePalaceV183Boxes(site.boxes, minecraft);
      boxes.name = minecraft ? `${site.name}: independent exterior block skin` : `${site.name}: restrained facade relief`;
      boxes.userData.noHiddenSolidInfill = true; group.add(boxes);
    }
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}
