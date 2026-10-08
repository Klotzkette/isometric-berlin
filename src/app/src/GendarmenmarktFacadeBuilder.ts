import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, ExtrudeGeometry, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Shape, Vector3,
} from "three";
import { letteringStrokePaths } from "./drawnLettering";

/** Exterior source edge; positive side is the left normal in the X/Z plane. */
export type PerimeterFacadeEdge = {
  startXZ: number[];
  endXZ: number[];
  outwardSide: number;
  wallBaseY: number;
  wallTopY: number;
  street: string;
  prismId: string;
};
type Point = [number, number, number];
type Kind = "stone" | "glass" | "arched-glass" | "segmental-glass";
type Instance = { matrix: number[]; color: number };
const UP = new Vector3(0, 1, 0);

export function perimeterEdgeLength(edge: PerimeterFacadeEdge): number {
  return Math.hypot(edge.endXZ[0] - edge.startXZ[0], edge.endXZ[1] - edge.startXZ[1]);
}

export function perimeterFacadePoint(edge: PerimeterFacadeEdge, u: number, y: number, out: number): Point {
  const length = perimeterEdgeLength(edge);
  const dx = (edge.endXZ[0] - edge.startXZ[0]) / length;
  const dz = (edge.endXZ[1] - edge.startXZ[1]) / length;
  return [edge.startXZ[0] + dx * u - dz * out * edge.outwardSide,
    y, edge.startXZ[1] + dz * u + dx * out * edge.outwardSide];
}

function archGeometry(rise = .5): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-.5, -.5); shape.lineTo(.5, -.5); shape.lineTo(.5, .5 - rise);
  shape.absellipse(0, .5 - rise, .5, rise, 0, Math.PI, false, 0);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(0, 0, -.5);
  geometry.deleteAttribute("uv");
  return geometry;
}

/** One static batch per material/shape, with no duplicate constructor buffers. */
export class GendarmenmarktFacadeBuilder {
  readonly batches = new Map<Kind, Instance[]>();
  readonly windowProbes: { edge: PerimeterFacadeEdge; center: Point; width: number; height: number }[] = [];
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly size = new Vector3();
  private readonly rotation = new Quaternion();

  constructor(readonly minecraft: boolean, private readonly sillUndercut = false) {}

  box(position: Point, size: Point, color: number, yaw = 0, kind: Kind = "stone"): void {
    this.add(position, size, color, this.rotation.setFromAxisAngle(UP, yaw), kind);
  }

  private add(position: Point, size: Point, color: number, rotation: Quaternion, kind: Kind): void {
    if (!position.every(Number.isFinite) || !size.every(v => Number.isFinite(v) && v > 0)) {
      throw new Error("Non-finite perimeter facade member");
    }
    const batch = this.batches.get(kind) ?? [];
    this.matrix.compose(this.position.set(...position), rotation, this.size.set(...size));
    batch.push({ matrix: this.matrix.toArray(), color });
    this.batches.set(kind, batch);
  }

  point(edge: PerimeterFacadeEdge, u: number, y: number, out: number): Point {
    // Clear the existing coarse wall voxels without enlarging a building mass.
    return perimeterFacadePoint(edge, u, y, out + (this.minecraft ? 1.2 : 0));
  }

  face(edge: PerimeterFacadeEdge, u: number, y: number, width: number, height: number,
    depth: number, color: number, out = .2, kind: Kind = "stone"): void {
    const yaw = -Math.atan2(edge.endXZ[1] - edge.startXZ[1], edge.endXZ[0] - edge.startXZ[0]);
    this.box(this.point(edge, u, y, out), [width, height, depth], color, yaw, kind);
  }

  beam(a: Point, b: Point, thickness: number, color: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a));
    const length = direction.length();
    if (length < .001) return;
    this.add(a.map((v, i) => (v + b[i]) / 2) as Point, [thickness, length, thickness], color,
      this.rotation.setFromUnitVectors(UP, direction.multiplyScalar(1 / length)), "stone");
  }

  window(edge: PerimeterFacadeEdge, u: number, y: number, width: number, height: number,
    trim: number, frame: number, glass: number, arched = false, out = .32, segmental = false): void {
    if (y - height / 2 < edge.wallBaseY || y + height / 2 > edge.wallTopY) return;
    const rise = segmental ? .2 : .5;
    const archBase = y + height * (.5 - rise);
    const center = this.point(edge, u, y, out);
    this.windowProbes.push({ edge, center, width, height });
    if (arched && this.minecraft) {
      for (let row = 0; row < 6; row++) {
        const t = (row + .5) / 6;
        this.face(edge, u, y + (t - .5) * height,
          width * (t < 1 - rise ? 1 : Math.sqrt(1 - ((t - (1 - rise)) / rise) ** 2)), height / 6, .12, glass, out, "glass");
      }
    } else this.face(edge, u, y, width, height, .12, glass, out, arched ? segmental ? "segmental-glass" : "arched-glass" : "glass");
    this.face(edge, u, y - height / 2 - .08, width + .30, .16, .32, trim, out + .06);
    // A narrow recessed drip edge makes the source-aligned sill read in the
    // unlit drawn modes too. Section/colour are display estimates (v183).
    if (this.sillUndercut) this.face(edge, u, y - height / 2 - .18, width + .18, .045, .10,
      0x79786e, out + .025);
    for (const side of [-1, 1]) this.face(edge, u + side * (width / 2 + .065),
      y - (arched ? height * rise / 2 : 0), .13, arched ? height * (1 - rise) : height, .18, trim, out + .03);
    if (arched) {
      const segments = this.minecraft ? 6 : 12;
      for (let i = 0; i < segments; i++) {
        const a = i * Math.PI / segments, b = (i + 1) * Math.PI / segments;
        this.beam(this.point(edge, u + Math.cos(a) * (width / 2 + .065),
          archBase + Math.sin(a) * (height * rise + .065), out + .05),
        this.point(edge, u + Math.cos(b) * (width / 2 + .065),
          archBase + Math.sin(b) * (height * rise + .065), out + .05), .14, trim);
      }
    } else this.face(edge, u, y + height / 2 + .07, width + .3, .14, .22, trim, out + .03);
    if (!this.minecraft) {
      this.face(edge, u, y, .075, height, .08, frame, out + .10);
      this.face(edge, u, y - height * .1, width, .08, .08, frame, out + .10);
    }
  }

  rail(edge: PerimeterFacadeEdge, u: number, y: number, width: number, out: number, color: number): void {
    this.face(edge, u, y, width, .085, .1, color, out);
    this.face(edge, u, y - .85, width, .085, .1, color, out);
    const count = Math.max(2, Math.ceil(width / (this.minecraft ? .65 : .38)));
    for (let i = 0; i <= count; i++) this.face(edge, u - width / 2 + width * i / count,
      y - .42, .075, .9, .075, color, out);
  }

  sign(edge: PerimeterFacadeEdge, text: string, u: number, y: number,
    capHeight: number, width: number, color: number, backing: number, out = .55): void {
    const paths = letteringStrokePaths(text, capHeight);
    const xs = paths.flat().map(p => p[0]);
    const extent = Math.max(...xs) - Math.min(...xs);
    const fit = Math.min(1, (width - .25) / extent);
    this.face(edge, u, y + capHeight / 2, width, capHeight + .35, .1, backing, out);
    // Keep writing left-to-right when viewed from the exterior of either edge.
    const direction = edge.outwardSide;
    const map = ([x, yy]: [number, number]): Point => this.point(edge,
      u + direction * x * fit, y + yy, out + .08);
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      this.beam(map(path[i - 1]), map(path[i]), capHeight * .095, color);
    }
  }

  finish(name: string): Group {
    const root = new Group();
    root.name = name;
    const box = new BoxGeometry(1, 1, 1);
    box.deleteAttribute("uv");
    const tint = new Color();
    for (const [kind, instances] of this.batches) {
      if (instances.length === 0) continue;
      const geometry = kind === "arched-glass" ? archGeometry() : kind === "segmental-glass" ? archGeometry(.2) : box;
      const dayMaterial = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
      const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, side: DoubleSide,
        roughness: .85, flatShading: true,
        emissive: kind === "stone" ? 0x000000 : 0x9d7545,
        emissiveIntensity: kind === "stone" ? 0 : .28 });
      const mesh = new InstancedMesh(geometry, dayMaterial, 0);
      const matrices = new Float32Array(instances.length * 16);
      const colors = new Float32Array(instances.length * 3);
      instances.forEach((item, i) => {
        matrices.set(item.matrix, i * 16);
        tint.setHex(item.color).toArray(colors, i * 3);
      });
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
      mesh.count = instances.length;
      mesh.name = `${name} ${kind}`;
      mesh.userData = { dayMaterial, nightMaterial, textureFree: true, facadeOnly: true };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      root.add(mesh);
    }
    root.userData = { textureFree: true, facadeOnly: true, hiddenSolidInfill: false,
      fullAndMobileIdentical: true, blockNative: this.minecraft, keepInMinecraft: this.minecraft,
      windowCount: this.windowProbes.length };
    return root;
  }
}
