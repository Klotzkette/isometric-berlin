import {
  BoxGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Path, PlaneGeometry, Shape, ShapeGeometry,
} from "three";
import { worldGroundSampler, type VoxelPayload } from "./MinecraftVoxelWorld";
import { BEBEL_LIBRARY_GROUND_PATCH as PATCH, BEBEL_LIBRARY_MEMORIAL as P } from "./bebelplatzMemorialProfile";
import buildingSource from "./bebelplatzBuildingSource.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Block = { p: [number, number, number]; s: [number, number, number]; color: number };

/** Actual below-ground room. The visitor remains on the continuous glass floor. */
export function createBebelplatzMemorial(ground: VoxelPayload, minecraft = false): Group {
  const root = new Group();
  root.name = minecraft ? "Block-native Bebelplatz empty library" : P.name;
  root.userData.sourceProfile = P;
  root.userData.schwellenraumGeschuetzt = true;
  root.userData.textureFree = true;
  const [cx, cz] = P.worldM;
  const top = (worldGroundSampler(ground)(cx, cz) ?? 5.2) + 0.08;
  const rotation = minecraft ? 0 : P.rotationY;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const world = (x: number, z: number): [number, number] => [cx + c * x + s * z, cz - s * x + c * z];
  const blocks: Block[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) =>
    blocks.push({ p: [x, y, z], s: [w, h, d], color });
  const half = P.roomWidthM / 2;
  const floor = top - P.roomHeightM;
  const ceiling = top - 0.16;
  box(0, floor - 0.06, 0, P.roomWidthM + 0.16, 0.12, P.roomWidthM + 0.16, 0xe2e6de);
  // Solid white plaster rear walls and projecting empty shelves; there are no books.
  for (const side of [-1, 1]) {
    box(side * (half + 0.08), (floor + ceiling) / 2, 0, 0.16, ceiling - floor, P.roomWidthM + 0.16, side < 0 ? 0xb3bdb9 : 0xc1c9c3);
    box(0, (floor + ceiling) / 2, side * (half + 0.08), P.roomWidthM, ceiling - floor, 0.16, side < 0 ? 0xb9c3bc : 0xaebbb5);
    for (let level = 0; level < P.shelfTiers; level++) {
      const y = floor + 0.12 + level * (P.roomHeightM - 0.38) / P.shelfTiers;
      box(side * (half - 0.12), y, 0, 0.24, 0.055, P.roomWidthM, 0xf2f2e9);
      box(0, y, side * (half - 0.12), P.roomWidthM - 0.48, 0.055, 0.24, 0xe9ede5);
      // Real shelf depth stays legible through the small pane without filling
      // it with books or replacing the chamber with a texture. The dark lip is
      // a bounded baked underside cue for the otherwise unlit Basic material.
      box(side * (half - 0.122), y - 0.052, 0, 0.244, 0.048, P.roomWidthM, 0x939f9a);
      box(0, y - 0.052, side * (half - 0.122), P.roomWidthM - 0.48, 0.048, 0.244, 0x939f9a);
    }
    for (let bay = 0; bay <= 7; bay++) {
      const u = -half + 0.1 + bay * (P.roomWidthM - 0.2) / 7;
      box(side * (half - 0.12), (floor + ceiling) / 2, u, 0.24, ceiling - floor, 0.06, 0xf2f2e9);
      box(u, (floor + ceiling) / 2, side * (half - 0.12), 0.06, ceiling - floor, 0.24, 0xe9ede5);
    }
  }
  // Closed, imagined door in the north wall. It is not a playable entrance.
  box(0, floor + 1.12, -half + 0.48, 0.88, 2.12, 0.045, 0xd2dbd6);
  for (const side of [-1, 1]) box(side * 0.48, floor + 1.12, -half + 0.52, 0.05, 2.22, 0.08, 0xf2f2e9);
  box(0, floor + 2.24, -half + 0.52, 1.01, 0.06, 0.08, 0xf2f2e9);
  // Recessed pale reveal immediately below the glass, outside its clear
  // opening. A finite thickness makes the sealed ground aperture readable.
  for (const side of [-1, 1]) {
    box(side * (P.glassWidthM / 2 + 0.045), top - 0.08, 0,
      0.09, 0.16, P.glassWidthM + 0.18, 0xdbe1db);
    box(0, top - 0.08, side * (P.glassWidthM / 2 + 0.045),
      P.glassWidthM, 0.16, 0.09, 0xdbe1db);
  }

  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffffff }), blocks.length);
  mesh.name = "Bebelplatz illuminated empty shelves and chamber";
  const matrix = new Matrix4(), yaw = new Matrix4().makeRotationY(rotation), paint = new Color();
  blocks.forEach((b, i) => {
    matrix.makeScale(...b.s); matrix.premultiply(yaw);
    const [x, z] = world(b.p[0], b.p[2]); matrix.setPosition(x, b.p[1], z);
    mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, paint.setHex(b.color));
  });
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  // The memorial's internal illumination remains white through the glass at night.
  mesh.userData.dayMaterial = mesh.material;
  mesh.userData.nightMaterial = mesh.material;
  mesh.userData.emptyShelfTiers = P.shelfTiers;
  root.add(mesh);

  // Continuous granite-sett plaza follows the exact OSM boundary. It also closes
  // the six removed coarse ground cells around the small, real glass aperture.
  const shape = new Shape();
  const plazaRing = buildingSource.plaza_source.ring;
  plazaRing.forEach(([x, z], i) => { if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z); });
  shape.closePath();
  const aperture = new Path();
  const a = P.glassWidthM / 2;
  for (const [i, [x, z]] of [[-a, -a], [a, -a], [a, a], [-a, a]].entries()) {
    const [wx, wz] = world(x, z); if (i === 0) aperture.moveTo(wx, -wz); else aperture.lineTo(wx, -wz);
  }
  aperture.closePath(); shape.holes.push(aperture);
  const pavingGeometry = new ShapeGeometry(shape); pavingGeometry.rotateX(-Math.PI / 2); pavingGeometry.translate(0, top, 0);
  const paving = new Mesh(pavingGeometry, new MeshBasicMaterial({ color: 0xb9b8aa, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  paving.name = "Bebelplatz paving with open memorial aperture";
  paving.userData.dayMaterial = paving.material;
  paving.userData.nightMaterial = new MeshStandardMaterial({ color: 0xb9b8aa, side: DoubleSide, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  root.add(paving);

  const trim: Block[] = [];
  const frame = (x:number,z:number,w:number,d:number,color:number,y=top+0.018) => trim.push({p:[x,y,z],s:[w,0.028,d],color});
  for (const side of [-1, 1]) {
    frame(side * (a + 0.035), 0, 0.07, P.glassWidthM + 0.14, 0x738783);
    frame(0, side * (a + 0.035), P.glassWidthM, 0.07, 0x738783);
    frame(side * (a + 0.004), 0, 0.012, P.glassWidthM, 0xb8cfca);
    frame(0, side * (a + 0.004), P.glassWidthM, 0.012, 0xb8cfca);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    frame(sx * (a + 0.036), sz * (a + 0.036), 0.026, 0.026, 0xd3dbd6, top + 0.034);
  // The two separately mapped bronze plaques stay at their original OSM anchors.
  const details = new InstancedMesh(new BoxGeometry(1,1,1), new MeshBasicMaterial({color:0xffffff}),trim.length);
  details.name = "Bebelplatz flush steel glass frame";
  trim.forEach((b,i) => {matrix.makeScale(...b.s);matrix.premultiply(yaw);const [x,z]=world(b.p[0],b.p[2]);matrix.setPosition(x,b.p[1],z);details.setMatrixAt(i,matrix);details.setColorAt(i,paint.setHex(b.color));});
  details.computeBoundingBox(); details.computeBoundingSphere();
  details.userData.dayMaterial = details.material;
  details.userData.nightMaterial = new MeshStandardMaterial({color:0xffffff,roughness:0.55,metalness:0.25});
  root.add(details);
  const glassGeometry = new PlaneGeometry(P.glassWidthM, P.glassWidthM);
  glassGeometry.rotateX(-Math.PI / 2); glassGeometry.rotateY(rotation);
  const glassMaterial = new MeshBasicMaterial({ color: 0xc7dfe0, transparent: true, opacity: 0.085, depthWrite: false, side: DoubleSide });
  const glass = new Mesh(glassGeometry, glassMaterial);
  glass.name = "Bebelplatz transparent walkable glass pane";
  glass.position.set(cx, top + 0.021, cz); glass.renderOrder = 3;
  glass.userData.dayMaterial = glassMaterial; glass.userData.nightMaterial = glassMaterial;
  root.add(glass);
  root.userData.groundPatch = PATCH;
  root.userData.bookCount = 0;
  root.userData.glassGroundY = top;
  freezeStaticSceneTransforms(root);
  return root;
}
