import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from "three";
import source from "./data/kalkscheuneFacadesV218.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Block = { position: [number, number, number]; size: [number, number, number]; yaw: number; roll: number; color: number; role: string; owner: string };
const C = { plaster: 0xd9d9ce, stone: 0xc6c5b7, frame: 0x425952, glass: 0x597274, shine: 0x7e9795, seam: 0xb1b3aa, ink: 0x303b39 };
/** All measured shells remain resident. Only the three audited owners' old
 * drawn facade recipes are transferred; no source wall/roof is replaced. */
export function planKalkscheuneFacadesV218(native = false): Block[] {
  const blocks: Block[] = [];
  for (const wall of source.walls) {
    const [ax, az] = wall.a, [bx, bz] = wall.b, [nx, nz] = wall.normal;
    const length = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / length, dz = (bz - az) / length;
    const yaw = -Math.atan2(dz, dx), corner = wall.role.startsWith("corner"), front = wall.role === "corner-west";
    const floors = corner ? 2 : 3, height = wall.eave - wall.base;
    const emit = (u: number, y: number, w: number, h: number, depth: number, out: number, color: number, role: string, roll = 0) => {
      if (native) {
        // Follow the existing 2 m orthogonal source envelope. Fine strips share
        // its staircase rather than rotating a second smooth facade over it.
        const pieces = Math.max(1, Math.ceil(w / .45));
        for (let j = 0; j < pieces; j++) {
          const ds = -w / 2 + (j + .5) * w / pieces;
          const t = u + ds * Math.cos(roll);
          let x = ax + dx * t, z = az + dz * t;
          const yy = y + ds * Math.sin(roll);
          const faceX = Math.abs(nx) >= Math.abs(nz);
          if (faceX) x = (nx < 0 ? Math.floor(x / 2) : Math.ceil(x / 2)) * 2 + nx * (out + .04);
          else z = (nz < 0 ? Math.floor(z / 2) : Math.ceil(z / 2)) * 2 + nz * (out + .04);
          const along = Math.abs(Math.cos(roll)) * w / pieces + Math.abs(Math.sin(roll)) * h;
          const rise = Math.abs(Math.sin(roll)) * w / pieces + Math.abs(Math.cos(roll)) * h;
          const width = along * (faceX ? Math.abs(dz) : Math.abs(dx)) + .018;
          blocks.push({ position: [x, yy, z], size: faceX ? [depth, rise, width] : [width, rise, depth], yaw: 0, roll: 0, color, role, owner: wall.id });
        }
      } else blocks.push({ position: [ax + dx * u + nx * out, y, az + dz * u + nz * out], size: [w, h, depth], yaw, roll, color, role, owner: wall.id });
    };
    // In native mode the retained source cells also contain baked generic
    // windows. A thin source-facing plaster skin carries the corrected rhythm.
    if (native) emit(length / 2, wall.base + height / 2, length, height, .07, .08, C.plaster, "native plaster skin");
    const bays = front ? 3 : Math.max(1, Math.round(length / (corner ? 3.6 : 3.05)));
    const pitch = length / bays;
    const windowW = Math.min(corner ? 1.85 : 1.68, pitch * .58);
    for (let f = 0; f < floors; f++) for (let i = 0; i < bays; i++) {
      const u = (i + .5) * pitch, door = front && f === 0 && i === bays - 1;
      const h = door ? 3.3 : corner ? 2.28 : 2.1;
      const y = door ? wall.base + h / 2 : wall.base + (f + .5) * height / floors;
      const w = door ? windowW + .15 : windowW;
      emit(u, y, w + .24, h + .24, .12, .17, C.stone, "window surround");
      emit(u, y, w, h, .07, .255, door ? C.frame : C.glass, door ? "entrance" : "glazing");
      emit(u - w * .21, y + h * .08, w * .30, h * .80, .018, .304, C.shine, "muted reflection");
      for (const du of [-w / 2, 0, w / 2]) emit(u + du, y, .07, h, .06, .32, C.frame, "vertical sash");
      for (const v of [-h / 2, 0, h / 2]) emit(u, y + v, w, .065, .06, .32, C.frame, "transom");
      if (!corner) for (const v of [-h / 4, h / 4]) emit(u, y + v, w, .045, .04, .32, C.frame, "factory muntin");
      emit(u, y - h / 2 - .13, w + .35, .12, .28, .23, C.stone, "stone sill");
      if (front && f === 0) for (let a = 0; a < 12; a++) {
        const t = -Math.PI / 2 + a * Math.PI / 11;
        emit(u + Math.sin(t) * (w / 2 + .12), y + h / 2 + Math.cos(t) * .28, .20, .10, .15, .24, C.stone, "segmental arch", -t * .25);
      }
    }
    for (const [y,h] of [[wall.base + .28,.4],[wall.eave - .14,.22],...(corner ? [[wall.base + height / 2,.14]] : [])])
      emit(length / 2, y, length, h, .23, .12, C.stone, "source-bound course");
    if (front) {
      const signY = wall.base + height * .50;
      emit(length / 2, signY, length - .35, 1.12, .14, .25, C.plaster, "Kalkscheune sign panel");
      for (const path of letteringStrokePaths("KALKSCHEUNE", .56)) for (let n = 1; n < path.length; n++) {
        const [x0,y0] = path[n-1], [x1,y1] = path[n];
        emit(length / 2 + (x0+x1)/2, signY - .28 + (y0+y1)/2, Math.hypot(x1-x0,y1-y0), .065, .035, .35, C.ink, "KALKSCHEUNE lettering", Math.atan2(y1-y0,x1-x0));
      }
      // One photographed divided attic opening on the retained half-hip gable.
      emit(length / 2, wall.eave + 1.35, 1.65, 1.1, .09, .17, C.stone, "attic surround");
      emit(length / 2, wall.eave + 1.35, 1.43, .89, .07, .24, C.glass, "attic glazing");
      for (const d of [-.48,0,.48]) emit(length/2+d,wall.eave+1.35,.065,.89,.06,.30,C.frame,"attic sash");
      emit(length/2,wall.eave+1.35,1.43,.06,.06,.30,C.frame,"attic transom");
    }
  }
  return blocks;
}

export function createKalkscheuneFacadesV218(native = false, diagnostics = false): Group {
  const root = new Group(), blocks = planKalkscheuneFacadesV218(native);
  root.name = "Kalkscheune source-bound facades v218" + (native ? " native" : "");
  root.userData = { kalkscheuneV218: true, sourceParentIds: source.parents, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, fullStaticDetailOnTouch: true, textureFree: true, sourceBodiesRetained: true, sourcePolicy: source.policy };
  if (diagnostics) root.userData.blocks = blocks;
  const cube = new BoxGeometry(1,1,1); cube.deleteAttribute("uv");
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: .83 });
  const mesh = new InstancedMesh(cube, material, blocks.length), matrix = new Matrix4(), local = new Matrix4(), size = new Vector3(), color = new Color();
  blocks.forEach((b,i) => {
    matrix.makeRotationY(b.yaw).multiply(local.makeRotationZ(b.roll)).scale(size.set(...b.size)).setPosition(...b.position);
    mesh.setMatrixAt(i,matrix); mesh.setColorAt(i,color.setHex(b.color));
  });
  mesh.name = "Kalkscheune plaster, divided windows, factory glazing and sign";
  mesh.userData.dayMaterial = material;
  mesh.userData.nightMaterial = new MeshStandardMaterial({ color: 0x7b8793, roughness: .83 });
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
