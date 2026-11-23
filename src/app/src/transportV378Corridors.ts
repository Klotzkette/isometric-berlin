import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import type { SurroundingPolygon } from "./SurroundingCityGeometry";

/** [OSM way, drawing type, overall width, mapped lanes, previous surface grade, route metres, XZ decimetres in the cell]. */
export type TransportRowV378 = [number, number, number, number, number, number, number[]];
type P = [number, number];
type Buffers = { positions: number[]; details: number[]; shape: number[]; indices: number[] };
const blank = (): Buffers => ({ positions: [], details: [], shape: [], indices: [] });
const fragment = `
  float role=vTransportShape.x, widthM=vTransportShape.y, lanes=vTransportShape.z;
  float along=vTransportDetail.x, side=vTransportDetail.y;
  float aa=max(fwidth(side),.022); float alongAA=max(fwidth(along),.015);
  float lineWidth=role<2.5?.15:.085;
  float laneWidth=widthM/max(lanes,1.); float dist=abs(fract((side+widthM*.5)/laneWidth+.5)-.5)*laneWidth;
  float lane=(1.-smoothstep(lineWidth*.5-aa*.5,lineWidth*.5+aa*.5,dist)) * (1.-smoothstep(widthM*.5-laneWidth*.5,widthM*.5,abs(side)));
  float dashPhase=abs(fract((along+2.5)/12.)-.5)*12.;
  float dashes=mix(1.-smoothstep(2.5-alongAA*.5,2.5+alongAA*.5,dashPhase),5./12.,smoothstep(2.,12.,alongAA));
  lane*=dashes*step(1.5,lanes);
  if(role<2.5){
    float edge=(1.-smoothstep(.07-aa*.5,.07+aa*.5,abs(abs(side)-(widthM*.5-.56))))*step(4.,widthM);
    float stripe=role<1.5?lane:max(lane,edge);
    diffuseColor.rgb=mix(vec3(.100,.112,.110),vec3(.650,.663,.641),stripe);
    if(role<1.5){diffuseColor.rgb=vec3(.72,.74,.71);diffuseColor.a*=stripe;}
  } else {
    float steel=1.-smoothstep(.053-aa*.5,.053+aa*.5,abs(abs(side)-.7175));
    float crossDist=abs(fract(along/.64+.5)-.5)*.64;
    float sleeper=mix(1.-smoothstep(.10-alongAA*.5,.10+alongAA*.5,crossDist),.3125,smoothstep(.20,.8,alongAA));
    sleeper*=1.-smoothstep(1.23-aa*.5,1.23+aa*.5,abs(side));
    diffuseColor.rgb=mix(mix(vec3(.23,.205,.175),vec3(.39,.365,.31),sleeper),vec3(.57,.595,.57),steel);
    if(role<3.5){diffuseColor.rgb=vec3(.57,.595,.57);diffuseColor.a*=steel;}
  }
  if(diffuseColor.a<.012)discard;`;

function materials(overlay: boolean, native: boolean) {
  const options = {
    color: 0xffffff,
    side: DoubleSide,
    transparent: overlay,
    depthWrite: !overlay,
    polygonOffset: overlay,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  };
  const day = native
    ? new MeshStandardMaterial({ ...options, roughness: 1 })
    : new MeshBasicMaterial(options);
  const night = native ? day : new MeshStandardMaterial({ ...options, roughness: 1 });
  for (const material of new Set([day, night])) {
    material.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec2 transportDetail; attribute vec3 transportShape; varying vec2 vTransportDetail; varying vec3 vTransportShape;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvTransportDetail=transportDetail; vTransportShape=transportShape;",
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vTransportDetail; varying vec3 vTransportShape;",
        )
        .replace("#include <color_fragment>", "#include <color_fragment>\n" + fragment);
    };
    material.customProgramCacheKey = () => "transport-geometry-v378";
  }
  return { day, night };
}

function joint(points: number[], i: number, side: number): P {
  const x = points[i] / 10,
    z = points[i + 1] / 10,
    b = Math.max(0, i - 2),
    e = Math.min(points.length - 2, i + 2);
  const lx = x - points[b] / 10,
    lz = z - points[b + 1] / 10,
    rx = points[e] / 10 - x,
    rz = points[e + 1] / 10 - z;
  const la = Math.hypot(lx, lz),
    ra = Math.hypot(rx, rz);
  const ux = la ? lx / la : rx / ra,
    uz = la ? lz / la : rz / ra,
    vx = ra ? rx / ra : ux,
    vz = ra ? rz / ra : uz;
  const m = Math.max(0.6, 1 + ux * vx + uz * vz);
  return [x - ((uz + vz) * side) / m, z + ((ux + vx) * side) / m];
}

function nativeRuns(corners: P[], append: (quad: P[]) => void) {
  const unit = 1,
    low = Math.min(...corners.map((p) => p[1])),
    high = Math.max(...corners.map((p) => p[1]));
  for (let z = Math.floor(low); z < high; z += unit) {
    const cut = z + unit / 2,
      xs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i],
        b = corners[(i + 1) % 4];
      if ((a[1] <= cut && b[1] > cut) || (b[1] <= cut && a[1] > cut))
        xs.push(a[0] + ((b[0] - a[0]) * (cut - a[1])) / (b[1] - a[1]));
    }
    if (xs.length < 2) continue;
    const a = Math.ceil(Math.min(...xs) - 0.5),
      b = Math.ceil(Math.max(...xs) - 0.5);
    if (b > a)
      append([
        [a, z],
        [a, z + unit],
        [b, z + unit],
        [b, z],
      ]);
  }
}

export function createTransportCorridorsV378(
  rows: readonly TransportRowV378[],
  ix: number,
  iz: number,
  native: boolean,
) {
  const root = new Group(),
    opaque = blank(),
    overlays = blank();
  const ground: SurroundingPolygon[] = [],
    roads: SurroundingPolygon[] = [];
  root.name = "Berliner Autobahnen und S-Bahn-Anfahrt zum BER v378";
  root.position.set(ix * 512, 0, iz * 512);
  for (const [id, role, widthM, lanes, y, from, points] of rows) {
    if (
      !Number.isSafeInteger(id) ||
      points.length < 4 ||
      points.length % 2 ||
      !(widthM > 0 && widthM <= 32) ||
      !(role >= 1 && role <= 4)
    )
      continue;
    const overlay = role === 1 || role === 3,
      buffers = overlay ? overlays : opaque;
    let along = from;
    for (let i = 0; i < points.length - 2; i += 2) {
      const x = points[i] / 10,
        z = points[i + 1] / 10,
        dx = points[i + 2] / 10 - x,
        dz = points[i + 3] / 10 - z,
        length = Math.hypot(dx, dz);
      if (length < 0.01) continue;
      const ux = dx / length,
        uz = dz / length;
      const corners = [
        joint(points, i, -widthM / 2),
        joint(points, i, widthM / 2),
        joint(points, i + 2, widthM / 2),
        joint(points, i + 2, -widthM / 2),
      ];
      const append = (quad: P[]) => {
        const offset = buffers.positions.length / 3;
        for (const [px, pz] of quad) {
          let grade = y;
          if (grade === -1) {
            const worldZ = pz + iz * 512;
            grade =
              worldZ < 6640
                ? 3.09 + ((9.4 - 3.09) * Math.max(0, worldZ - 6490)) / 150
                : worldZ < 6895
                  ? 9.4
                  : 9.4 - ((9.4 - 3.09) * Math.min(165, worldZ - 6895)) / 165;
            if (native) grade = Math.round(grade * 4) / 4;
          }
          buffers.positions.push(px, grade + (overlay ? 0.039 : 0.015), pz);
          buffers.details.push(along + (px - x) * ux + (pz - z) * uz, -(px - x) * uz + (pz - z) * ux);
          buffers.shape.push(role, widthM, lanes);
        }
        buffers.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        if (!overlay) {
          const polygon = { ring: quad.map(([x, z]) => [x, z]), holes: [] };
          ground.push(polygon);
          if (role === 2) roads.push(polygon);
        }
      };
      if (native) nativeRuns(corners, append);
      else append(corners);
      along += length;
    }
  }
  for (const [buffer, overlay] of [
    [opaque, false],
    [overlays, true],
  ] as const) {
    if (!buffer.indices.length) continue;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(buffer.positions, 3));
    geometry.setAttribute("transportDetail", new Float32BufferAttribute(buffer.details, 2));
    geometry.setAttribute("transportShape", new Float32BufferAttribute(buffer.shape, 3));
    geometry.setIndex(buffer.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const { day, night } = materials(overlay, native),
      mesh = new Mesh(geometry, day);
    mesh.name = overlay
      ? "Fahrstreifen und Schienen auf bestehendem Grund v378"
      : "Äußere Fahrbahnen und Gleiskörper v378";
    mesh.userData = {
      dayMaterial: day,
      nightMaterial: night,
      textureFree: true,
      keepInMinecraft: native,
      blockNative: native,
    };
    if (overlay) mesh.renderOrder = 2;
    root.add(mesh);
  }
  return { root, ground, roads };
}
