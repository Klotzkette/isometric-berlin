import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/kiezFacadesV209.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const KIEZ_FACADES_V209_GROUP = "Helmholtzplatz community and cafe facades v209";
export const KIEZ_FACADES_V209_OWNER_IDS = data.owners.map(owner => owner.id);

function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .86 }),
  };
}

function rootGroup(native: boolean, envelope: boolean): Group {
  const root = new Group();
  root.name = (envelope ? "Required Helmholtzplatz source envelopes v209" : KIEZ_FACADES_V209_GROUP) + (native ? " native" : "");
  root.userData = {
    kiezFacadesV209: true, helmholtzEnvelopesV209: envelope, textureFree: true,
    fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, sourceOwnerIds: KIEZ_FACADES_V209_OWNER_IDS,
    sourceParentIds: KIEZ_FACADES_V209_OWNER_IDS,
    sourceReceipt: "helmholtz-sites-v209-source.json",
    correctedPlatzhausHeight: 3.4, correctedHeightIsEstimate: true,
    sourceXZPreserved: true, originalSourceSheetsRetained: true,
    newCourtWalls: false, newPassageClosures: false,
  };
  return root;
}

function boxes(rows: readonly (readonly number[])[], native: boolean, name: string): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), size = new Vector3(), color = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else matrix.makeRotationY(r[6]).scale(size.set(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1], r[2]).toArray(matrices, i * 16);
    color.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = name;
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    nativeMinecraft: native, blockNative: native };
  return mesh;
}

/** Required before exposing transferred packet owners. Kiezkind retains all
 * measured wall/roof sheets. Only Platzhaus has an explicitly documented flat
 * single-storey interpretation, keeping every source XZ coordinate. */
export function createHelmholtzEnvelopesV209(native = false): Group {
  const root = rootGroup(native, true);
  if (native) root.add(boxes(data.shellBlocks, true, "Helmholtzplatz independent orthogonal shell skins"));
  else {
    const positions = new Float32Array(data.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0));
    const colors = new Float32Array(positions.length), tint = new Color();
    let offset = 0;
    for (const surface of data.surfaces) {
      tint.setHex(surface.color);
      for (const triangle of surface.triangles) for (const p of triangle) {
        positions.set(p, offset); tint.toArray(colors, offset); offset += 3;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const { day, night } = materials(true), mesh = new Mesh(geometry, day);
    mesh.name = "Kiezkind complete measured sheets and corrected low Platzhaus";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}

/** Tiny additive building recognition; generic district accents are delivered
 * separately through existing bounded kiez209 companion packets. */
export function createKiezFacadesV209(native = false): Group {
  const root = rootGroup(native, false);
  root.userData.additiveOnly = true;
  root.add(boxes(native ? data.blocks : data.boxes, native,
    "Helmholtzplatz estimated glazing, orange fins, transoms, sills and eaves"));
  return freezeStaticSceneTransforms(root);
}
