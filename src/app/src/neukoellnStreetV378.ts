import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

type PointXZ = [number, number];
type Surface = { kind: "setts" | "mosaic" | "slabs" | "pavers" | "island"; triangles: number[]; blocks: number[][] };
type Street = {
  surfaces: Surface[];
  edges: ["kerb" | "lowered" | "hedge", PointXZ[]][];
  points: ["bollard" | "removable" | "tactile", number, number, number][];
};
const stone = { setts: 0xaaa097, mosaic: 0xb9b0a3, slabs: 0xb7b2a8, pavers: 0xad9f91, island: 0xa79f92 };
const jointSizes = { setts: .19, mosaic: .095, slabs: .75, pavers: .31, island: .41 };
type Member = [number, number, number, number, number, number, number, number];

// Lowered kerbs and tactile strips belong to surveyed crossing points. The
// narrow mortar joints disappear gradually when several stones share a pixel.
function pavingMaterial(night: boolean) {
  const material = night ? new MeshStandardMaterial({ vertexColors: true, roughness: .96 }) :
    new MeshBasicMaterial({ vertexColors: true });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>",
      "#include <common>\nattribute vec2 pavingSize; varying vec3 pavingPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\npavingPosition = vec3(position.xz / pavingSize.x, pavingSize.y);");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>",
      "#include <common>\nvarying vec3 pavingPosition;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 course = pavingPosition.xy;
        vec2 footprint = fwidth(course);
        course.x += 0.5 * mod(floor(course.y), 2.0);
        vec2 dist = 0.5 - abs(fract(course) - 0.5);
        vec2 joint = 1.0 - smoothstep(vec2(0.018), vec2(0.038) + footprint * 0.55, dist);
        float fade = 1.0 - smoothstep(0.20, 0.92, max(footprint.x, footprint.y));
        diffuseColor.rgb *= 1.0 - max(joint.x, joint.y) * fade * pavingPosition.z;`);
  };
  return material;
}

function addSurfaces(root: Group, source: Street, native: boolean, ground: number) {
  const positions: number[] = [], colors: number[] = [], size: number[] = [];
  const color = new Color();
  for (const surface of source.surfaces) {
    color.setHex(stone[surface.kind]);
    const y = ground + (surface.kind === "island" ? .18 : .155);
    const point = (x: number, z: number) => {
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      size.push(jointSizes[surface.kind], native ? .14 : .25);
    };
    if (native) {
      for (const [x,z,n] of surface.blocks) {
        const right = x + n * .5, end = z + .5;
        point(x,z); point(x,end); point(right,end);
        point(x,z); point(right,end); point(right,z);
      }
    } else {
      for (let i = 0; i < surface.triangles.length; i+=6) {
        const [x,z, bx,bz, cx,cz] = surface.triangles.slice(i,i+6);
        point(x,z);
        if ((bx-x)*(cz-z) - (bz-z)*(cx-x) < 0) { point(bx,bz); point(cx,cz); }
        else { point(cx,cz); point(bx,bz); }
      }
    }
  }
  if (!positions.length) return;
  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions,3));
  geom.setAttribute("color",new Float32BufferAttribute(colors,3));
  geom.setAttribute("pavingSize",new Float32BufferAttribute(size,2));
  geom.computeVertexNormals();
  const day = pavingMaterial(false), night = pavingMaterial(true);
  const mesh = new Mesh(geom,day);
  mesh.name = "Hermannplatz setts, survey mosaics and Neukölln traffic islands";
  mesh.userData = {dayMaterial:day,nightMaterial:night};
  root.add(mesh);
}

function addMembers(root: Group, rows: Member[], round: boolean) {
  if (!rows.length) return;
  const geometry = round ? new CylinderGeometry(.5,.5,1,10) : new BoxGeometry();
  const day = new MeshBasicMaterial(), night = new MeshStandardMaterial({roughness:.84});
  const mesh = new InstancedMesh(geometry,day,rows.length);
  mesh.name = round ? "Mapped Neukölln street bollards" : "Weserstraße kerbs, bollards, hedges and tactile crossings";
  mesh.userData = {dayMaterial:day,nightMaterial:night};
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  for (let i=0; i<rows.length; i++) {
    const [x,y,z,w,h,d,angle,tone] = rows[i];
    matrix.makeRotationY(-angle).scale(scale.set(w,h,d)).setPosition(x,y,z);
    mesh.setMatrixAt(i,matrix);
    mesh.setColorAt(i,color.setHex(tone));
  }
  mesh.computeBoundingSphere();
  root.add(mesh);
}

export function createNeukoellnStreetV378(data: Street, native: boolean, ground: number) {
  const root = new Group(), boxes: Member[] = [], posts: Member[] = [];
  root.name = "Hermannplatz and Weserstraße mapped streetscape v378";
  addSurfaces(root,data,native,ground);
  for (const [kind,points] of data.edges) {
    const hedge=kind==="hedge", h=hedge ? .94 : kind==="lowered" ? .035 : .105;
    const width=hedge ? .68 : .17, y=ground+(hedge ? .08 : .09)+h/2;
    for (let i=1; i<points.length; i++) {
      const [a,b]=points[i-1], [c,d]=points[i], dx=c-a, dz=d-b, length=Math.hypot(dx,dz);
      if (length<.02) continue;
      const tone=hedge ? 0x536949 : 0xa9a59d;
      if (!native) boxes.push([(a+c)/2,y,(b+d)/2,length+.015,h,width,Math.atan2(dz,dx),tone]);
      else {
        // The narrow curb follows the source continuously as a run of
        // axis-aligned stones. Long orthogonal edges stay a single member.
        const pieces=Math.max(1,Math.ceil(Math.min(Math.abs(dx),Math.abs(dz))/.23));
        for (let j=0;j<pieces;j++) {
          const start=(j+.5)/pieces;
          boxes.push([a+dx*start,y,b+dz*start,Math.abs(dx)/pieces+width,h,Math.abs(dz)/pieces+width,0,tone]);
        }
      }
    }
  }
  for (const [kind,x,z,a] of data.points) {
    if (kind==="tactile") {
      const angle = native ? Math.round(a/(Math.PI/2))*Math.PI/2 : a;
      boxes.push([x,ground+.19,z,.64,.032,.82,angle,0xd8d4c9]);
      for (let j=-3; j<=3; j++) {
        const t = j*.102;
        boxes.push([x-Math.sin(angle)*t,ground+.213,z+Math.cos(angle)*t,.55,.014,.032,angle,0xbcb7ae]);
      }
    } else {
      const members = native ? boxes : posts;
      const removable=kind==="removable";
      members.push([x,ground+.51,z,.115,.86,.115,0,removable ? 0x984638 : 0x626460]);
      members.push([x,ground+.79,z,.12,.10,.12,0,removable ? 0xe0dcd2 : 0xa5a59d]);
    }
  }
  addMembers(root,boxes,false);
  addMembers(root,posts,true);
  return root;
}

export async function attachNeukoellnStreetV378(entry: SurroundingChunkGeometry, id: string, native: boolean, signal?: AbortSignal) {
  const {default:data} = await import(`./data/neukoellnStreetV378-${id}.json`) as {default: Street};
  signal?.throwIfAborted();
  attachWorldSpaceDetail(entry,createNeukoellnStreetV378(data,native,entry.nav.groundY));
}
