import { Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Vector3 } from "three";
import ring from "./data/transportV378Ring.json";

// Display stock is stationary. Its two endpoints follow the measured S41 course
// and its swept footprint has been tested against the existing platform polygon.
const paint = {
  underframe: 0x474b48,
  red: 0xa73139,
  ochre: 0xe4af42,
  door: 0x393d38,
  glass: 0x3f575b,
  roof: 0x747671,
  lamp: 0xf1eac8,
  bellows: 0x525550,
  tactile: 0xd9d6c4,
};
type Row = number[];

function nativeCar(
  rows: Row[],
  car: number[],
  base: number,
  width: number,
  first: boolean,
  last: boolean,
): void {
  const [ax, az, bx, bz] = car;
  const length = Math.hypot(bx - ax, bz - az),
    dx = (bx - ax) / length,
    dz = (bz - az) / length;
  const mx = (ax + bx) / 2,
    mz = (az + bz) / 2,
    cell = 0.5;
  const extentX = (Math.abs(dx) * length + Math.abs(dz) * width) / 2;
  const extentZ = (Math.abs(dz) * length + Math.abs(dx) * width) / 2;
  const x0 = Math.floor((mx - extentX) / cell),
    x1 = Math.ceil((mx + extentX) / cell);
  const z0 = Math.floor((mz - extentZ) / cell),
    z1 = Math.ceil((mz + extentZ) / cell);
  for (let iz = z0; iz < z1; iz++) {
    const z = (iz + 0.5) * cell;
    for (const [bottom, top, layer] of [
      [0.28, 0.83, 0],
      [0.83, 1.65, 1],
      [1.65, 2.75, 2],
      [2.75, 3.42, 3],
      [3.42, 3.75, 4],
    ]) {
      let start = x0,
        previous = 0;
      for (let ix = x0; ix <= x1; ix++) {
        const x = (ix + 0.5) * cell,
          u = (x - mx) * dx + (z - mz) * dz,
          v = -(x - mx) * dz + (z - mz) * dx;
        const end = (first && u < 0) || (last && u > 0);
        const remaining = length / 2 - Math.abs(u),
          inset = layer === 0 ? 0.23 : layer === 4 ? 0.18 : 0;
        let tone = 0;
        if (
          ix < x1 &&
          remaining >= 0 &&
          Math.abs(v) <= width / 2 - inset &&
          (!end || remaining >= (layer > 2 ? 0.38 : 0.12))
        ) {
          const edge = Math.abs(v) > width / 2 - 0.49;
          const door = edge && [-5.95, 0, 5.95].some((at) => Math.abs(u - at) < 0.68);
          const pane = edge && [-7.48, -3.6, -1.85, 1.85, 3.6, 7.48].some((at) => Math.abs(u - at) < 0.62);
          tone =
            layer === 0
              ? paint.underframe
              : layer === 4
                ? paint.roof
                : door
                  ? paint.door
                  : layer === 1
                    ? paint.red
                    : layer === 3
                      ? paint.ochre
                      : pane || (end && remaining < 0.65)
                        ? paint.glass
                        : paint.ochre;
        }
        if (tone === previous) continue;
        if (previous)
          rows.push([
            ((start + ix) * cell) / 2,
            base + (top + bottom) / 2,
            z,
            (ix - start) * cell,
            top - bottom,
            cell,
            previous,
          ]);
        start = ix;
        previous = tone;
      }
    }
  }
}

function drawnCar(
  rows: Row[],
  car: number[],
  base: number,
  width: number,
  first: boolean,
  last: boolean,
): void {
  const [ax, az, bx, bz] = car,
    length = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / length,
    dz = (bz - az) / length,
    mx = (ax + bx) / 2,
    mz = (az + bz) / 2,
    yaw = -Math.atan2(dz, dx);
  const box = (u: number, v: number, bottom: number, top: number, w: number, d: number, tone: number) =>
    rows.push([
      mx + dx * u - dz * v,
      base + (bottom + top) / 2,
      mz + dz * u + dx * v,
      w,
      top - bottom,
      d,
      yaw,
      tone,
    ]);
  box(0, 0, 0.3, 0.86, length - 1.1, width - 0.44, paint.underframe);
  box(0, 0, 0.86, 1.7, length, width - 0.04, paint.red);
  box(0, 0, 1.7, 3.36, length - 0.12, width, paint.ochre);
  box(0, 0, 3.36, 3.63, length - 0.42, width - 0.19, paint.roof);
  box(0, 0, 3.63, 3.76, length - 1.45, width - 0.54, paint.roof);
  for (const side of [-1, 1]) {
    const v = (side * width) / 2;
    for (const u of [-7.48, -3.6, -1.85, 1.85, 3.6, 7.48]) box(u, v, 1.95, 2.99, 1.3, 0.035, paint.glass);
    for (const u of [-5.95, 0, 5.95]) {
      box(u, v, 0.99, 3.04, 1.3, 0.06, paint.door);
      for (const sign of [-1, 1]) box(u + sign * 0.32, v + side * 0.04, 1.96, 2.85, 0.52, 0.035, paint.glass);
      box(u, v + side * 0.045, 1.02, 2.9, 0.055, 0.025, paint.ochre);
    }
  }
  for (const [s, cab] of [
    [-1, first],
    [1, last],
  ] as const) {
    const u = s * (length / 2 - 0.02);
    if (cab) {
      box(u, 0, 1.85, 3.03, 0.11, width - 0.38, paint.glass);
      for (const side of [-1, 1]) box(u + s * 0.04, side * width * 0.32, 1.22, 1.42, 0.08, 0.31, paint.lamp);
    } else box(u + s * 0.16, 0, 1.14, 3.02, 0.51, width - 0.38, paint.bellows);
  }
}

function tactileStrip(rows: Row[], native: boolean, a: number[], b: number[], grade: number): void {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  if (len < 0.01) return;
  if (!native) {
    rows.push([
      (a[0] + b[0]) / 2,
      grade + 0.035,
      (a[1] + b[1]) / 2,
      len,
      0.035,
      0.27,
      -Math.atan2(dz, dx),
      paint.tactile,
    ]);
    return;
  }
  const count = Math.ceil(Math.min(Math.abs(dx), Math.abs(dz)) / 0.75) || 1;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    rows.push([
      a[0] + dx * t,
      grade + 0.04,
      a[1] + dz * t,
      Math.max(0.27, Math.abs(dx) / count),
      0.036,
      Math.max(0.27, Math.abs(dz) / count),
      paint.tactile,
    ]);
  }
}

// Adjacent identical cardinal face strips are merged without changing their union.
function coalesceNative(rows: Row[]): Row[] {
  for (const axis of [2, 0, 1]) {
    const size = axis + 3;
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = row
        .filter((_, i) => i !== axis && i !== size)
        .map((v) => Math.round(v * 1e5))
        .join(",");
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    rows = [];
    for (const list of groups.values()) {
      list.sort((a, b) => a[axis] - b[axis]);
      let prev: Row | undefined;
      for (const row of list) {
        const lo = row[axis] - row[size] / 2,
          hi = row[axis] + row[size] / 2;
        if (prev && Math.abs(prev[axis] + prev[size] / 2 - lo) < 1e-5) {
          const start = prev[axis] - prev[size] / 2;
          prev[axis] = (start + hi) / 2;
          prev[size] = hi - start;
        } else {
          rows.push(row);
          prev = row;
        }
      }
    }
  }
  return rows;
}

function appendBoxes(mesh: InstancedMesh, rows: Row[], native: boolean): void {
  const start = mesh.count,
    total = start + rows.length,
    matrices = new Float32Array(total * 16),
    colours = new Float32Array(total * 3);
  matrices.set(mesh.instanceMatrix.array);
  colours.set(mesh.instanceColor!.array);
  const transform = new Matrix4(),
    scale = new Vector3(),
    tone = new Color();
  for (const [j, r] of rows.entries()) {
    if (native) transform.makeScale(r[3], r[4], r[5]);
    else transform.makeRotationY(r[6]).scale(scale.set(r[3], r[4], r[5]));
    transform.setPosition(r[0], r[1], r[2]).toArray(matrices, (start + j) * 16);
    tone.setHex(r[native ? 6 : 7]).toArray(colours, (start + j) * 3);
  }
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colours, 3);
  mesh.count = total;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.userData.transportRingSpanV378 = { start, count: rows.length };
}

/** Attach once per actual station host; Wedding's existing vertical relocation is inherited. */
export function attachTransportRingStationsV378(root: Group, native: boolean): void {
  for (const site of ring.stations) {
    const host = root.children.find(
      (child) => child.userData.stationName === site.name && child.userData.anchorOsmId === site.anchor,
    );
    if (!host || host.userData.transportRingV378) continue;
    const mesh = host.children.find(
      (child) => child instanceof InstancedMesh && child.userData.stationName === site.name,
    ) as InstancedMesh | undefined;
    if (!mesh?.instanceColor) continue;
    const platforms = new Set<string>(host.userData.platformIds),
      rows: Row[] = [];
    for (const strip of site.tactile)
      if (platforms.has(strip.platform)) {
        for (const line of strip.lines)
          for (let i = 1; i < line.length; i++) tactileStrip(rows, native, line[i - 1], line[i], strip.grade);
      }
    for (const vehicle of site.vehicles)
      if (platforms.has(vehicle.platform)) {
        vehicle.cars.forEach((car, i) => {
          const args = [
            rows,
            car,
            vehicle.grade - 0.96,
            vehicle.width,
            i === 0,
            i === vehicle.cars.length - 1,
          ] as const;
          if (native) nativeCar(...args);
          else drawnCar(...args);
        });
      }
    if (!rows.length) continue;
    appendBoxes(mesh, native ? coalesceNative(rows) : rows, native);
    mesh.userData.stationAnchorV378 = site.anchor;
    mesh.userData.carsV378 = site.vehicles
      .filter((v) => platforms.has(v.platform))
      .reduce((n, v) => n + v.cars.length, 0);
    host.userData.transportRingV378 = true;
  }
}
