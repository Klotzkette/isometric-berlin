import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide,
  Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import shared from "./data/prenzlauerSharedV380.json";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

export interface PrenzlauerStreetPacketV380 {
  origin: number[];
  n: number;
  faces: number;
  p: string;
  i: string;
  c: string;
  palette: number[];
  courses: number[];
  trees: number[][];
}

function decodeWords(text: string, length: number, planes: number): Uint16Array {
  const bytes = gunzipSync(decodeBase64Bytes(text));
  if (bytes.length !== length * planes * 2) throw new Error("Incomplete Prenzlauer street packet");
  const words = new Uint16Array(length * planes);
  for (let plane = 0; plane < planes; plane++) {
    let previous = 0;
    for (let i = plane * length; i < (plane + 1) * length; i++) {
      previous = (previous + bytes[i] + (bytes[words.length + i] << 8)) & 65535;
      words[i] = previous;
    }
  }
  return words;
}

function pavingMaterial(night: boolean) {
  const options = { vertexColors: true, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 };
  const material = night ? new MeshStandardMaterial({ ...options, roughness: .96 }) : new MeshBasicMaterial(options);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>",
      "#include <common>\nattribute float jointSize; varying vec3 streetPaving;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nstreetPaving = vec3(position.xz, jointSize);");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>",
      "#include <common>\nvarying vec3 streetPaving;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        // Align paving courses to the two street directions. The phase is stable
        // across 512 m packet boundaries, and joints fade below pixel scale.
        vec2 p = mat2(.832,.555,-.555,.832)*streetPaving.xy / max(.08,streetPaving.z);
        vec2 footprint = fwidth(p);
        p.x += mod(floor(p.y),2.)*.5;
        vec2 edge = .5-abs(fract(p)-.5);
        vec2 joint = 1.-smoothstep(vec2(.018), .045+footprint*.45, edge);
        float fade = 1.-smoothstep(.20,.90,max(footprint.x,footprint.y));
        diffuseColor.rgb *= 1.-step(.01,streetPaving.z)*.24*max(joint.x,joint.y)*fade;`);
  };
  return material;
}

function surfaceMesh(data: PrenzlauerStreetPacketV380) {
  const n = data.n;
  if (n < 1 || n > 65535 || data.faces < 1 || data.faces > 100000) throw new Error("Invalid Prenzlauer packet extent");
  const words = decodeWords(data.p, n, 3), positions = new Float32Array(n*3);
  const indices = decodeWords(data.i, data.faces*3, 1);
  const ids = gunzipSync(decodeBase64Bytes(data.c));
  if (ids.length !== n) throw new Error("Incomplete Prenzlauer palette stream");
  const rgb = new Uint8Array(n*3), sizes = new Uint8Array(n);
  const palette = data.palette.map(hex => new Color(hex).toArray().map(v => Math.round(v*255)));
  for (let v = 0; v < n; v++) {
    for (let axis = 0; axis < 3; axis++) {
      const cm = words[axis*n+v];
      positions[v*3+axis] = (cm < 32768 ? cm : cm-65536)*.01 + data.origin[axis];
    }
    rgb.set(palette[ids[v]], v*3);
    sizes[v] = Math.round(data.courses[ids[v]]*255);
  }
  const geometry = new BufferGeometry();
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(rgb, 3, true));
  geometry.setAttribute("jointSize", new BufferAttribute(sizes, 1, true));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const day = pavingMaterial(false), night = pavingMaterial(true);
  const mesh = new Mesh(geometry, day);
  mesh.name = "Kastanienallee und Oderberger Straße – Straßenbefahrung, Gleise und historische Fronten";
  mesh.userData = { dayMaterial: day, nightMaterial: night };
  return mesh;
}

type TreePart = { position: Vector3; rotation: Quaternion; size: Vector3; color: number };
const canopyColors = [0x78935e,0x839365,0x8f9c67,0x85965d,0x879963,0x819364];

function addTreeParts(root: Group, rows: TreePart[], geom: BufferGeometry, name: string) {
  if (!rows.length) { geom.dispose(); return; }
  const normals = geom.getAttribute("normal"), shades = new Float32Array(normals.count*3);
  for (let v = 0; v < normals.count; v++) {
    const light = .77+.17*normals.getY(v)-.07*normals.getX(v);
    shades.set([light,light,light],v*3);
  }
  geom.setAttribute("color",new BufferAttribute(shades,3));
  const day = new MeshBasicMaterial({vertexColors:true});
  const night = new MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});
  const mesh = new InstancedMesh(geom,day,rows.length), matrix = new Matrix4(), color = new Color();
  rows.forEach(({position,rotation,size,color:tone},i) => {
    mesh.setMatrixAt(i,matrix.compose(position,rotation,size));
    mesh.setColorAt(i,color.setHex(tone));
  });
  mesh.name = name;
  mesh.userData = { dayMaterial:day, nightMaterial:night };
  mesh.computeBoundingSphere();
  root.add(mesh);
}

function addSurveyTrees(root: Group, rows: number[][], native: boolean) {
  const wood: TreePart[] = [], leaves: TreePart[] = [];
  const rotation = new Quaternion(), vertical = new Vector3(0,1,0);
  for (const [x,z,y,h,w,girth,species,index] of rows) {
    const diameter = girth / (Math.PI * 100), top = y+h;
    const depth = Math.min(h*.79, Math.max(h*.46, w*(species===1 ? .87 : 1.12)));
    const trunkHeight = h-depth*.57;
    wood.push({position:new Vector3(x,y+trunkHeight/2,z),rotation,
      size:new Vector3(diameter,trunkHeight,diameter),color:0x756d59});
    if (native) {
      for (const [bottom,high,width] of [[0,.28,.56],[.19,.46,.82],[.42,.37,1],[.72,.22,.73],[.9,.1,.4]]) {
        leaves.push({position:new Vector3(x,top-depth+(bottom+high/2)*depth,z),rotation,
          size:new Vector3(w*width,high*depth,w*width),color:canopyColors[species]});
      }
    } else {
      leaves.push({position:new Vector3(x,top-depth*.42,z),rotation,
        size:new Vector3(w*.42,depth*.42,w*.42),color:canopyColors[species]});
      for (let k=0;k<3;k++) {
        const angle=index*2.39996+k*Math.PI*2/3, dx=Math.cos(angle),dz=Math.sin(angle);
        const cy=top-depth*.60;
        leaves.push({position:new Vector3(x+dx*w*.19,cy,z+dz*w*.19),rotation,
          size:new Vector3(w*.31,depth*.40,w*.31),color:canopyColors[species]});
        const start=new Vector3(x,y+trunkHeight*.74,z);
        const end=new Vector3(x+dx*w*.22,cy,z+dz*w*.22), axis=end.clone().sub(start);
        wood.push({position:start.clone().lerp(end,.5),
          rotation:new Quaternion().setFromUnitVectors(vertical,axis.clone().normalize()),
          size:new Vector3(diameter*.37,axis.length(),diameter*.37),color:0x756d59});
      }
    }
  }
  addTreeParts(root,wood,native ? new BoxGeometry() : new CylinderGeometry(.44,.56,1,7),"Katasterstämme und Äste");
  addTreeParts(root,leaves,native ? new BoxGeometry() : new IcosahedronGeometry(1,1),"Vermessene Straßenbaumkronen");
}

export function createPrenzlauerStreetsV380(data: PrenzlauerStreetPacketV380, native: boolean) {
  const group = new Group();
  group.name = "Kastanienallee und Oderberger Straße";
  group.userData = { nativeMinecraft:native, keepInMinecraft:native, prenzlauerStreetTrees:data.trees.length };
  group.add(surfaceMesh(data));
  addSurveyTrees(group,data.trees,native);
  return group;
}

export async function attachPrenzlauerStreetsV380(entry: SurroundingChunkGeometry, id: string, native: boolean, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const key = id + (shared.includes(id) ? "-shared" : native ? "-native" : "-drawn");
  const {default:data} = await import(`./data/prenzlauerStreetsV380/${key}.json`) as {default:PrenzlauerStreetPacketV380};
  signal?.throwIfAborted();
  attachWorldSpaceDetail(entry,createPrenzlauerStreetsV380(data,native));
}
