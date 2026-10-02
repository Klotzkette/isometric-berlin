import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import source from "./data/weinbergPlaygroundV174Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const WEINBERG_PLAYGROUND_V174_GROUP = "Weinbergspark blue rubber play surface";
export const WEINBERG_PLAYGROUND_V174_NATIVE_GROUP = "Weinbergspark blue rubber independent native surface";

function create(native: boolean): Group {
  const root = new Group();
  root.name = native ? WEINBERG_PLAYGROUND_V174_NATIVE_GROUP : WEINBERG_PLAYGROUND_V174_GROUP;
  root.userData = { northMitteV174: "weinberg", textureFree:true, blockNative:native, keepInMinecraft:native, fullStaticDetailOnTouch:true, playgroundId:"49217749", preservedSandPits:true };
  const day = new MeshBasicMaterial({ vertexColors:!native, side:DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors:!native, side:DoubleSide, roughness:.86, flatShading:true });
  let mesh: Mesh;
  const color = new Color();
  if (native) {
    const geometry = new BoxGeometry(1,1,1); geometry.deleteAttribute("uv");
    const blocks = new InstancedMesh(geometry,day,0), matrix = new Matrix4();
    const matrices = new Float32Array(source.nativeRows.length*16), colors = new Float32Array(source.nativeRows.length*3);
    source.nativeRows.forEach(([x,y,z,w,h,d,c],i) => {
      matrix.makeScale(w,h,d).setPosition(new Vector3(x,y,z)).toArray(matrices,i*16);
      color.setHex(c).toArray(colors,i*3);
    });
    blocks.count = source.nativeRows.length;
    blocks.instanceMatrix = new InstancedBufferAttribute(matrices,16);
    blocks.instanceColor = new InstancedBufferAttribute(colors,3);
    blocks.computeBoundingBox(); blocks.computeBoundingSphere(); mesh=blocks;
  } else {
    const positions:number[]=[], colors:number[]=[];
    for (const sheet of source.surfaces) {
      color.setHex(sheet.color);
      for (const triangle of sheet.triangles) for (const point of triangle) {
        positions.push(...point); colors.push(color.r,color.g,color.b);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
    geometry.setAttribute("color",new Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    mesh = new Mesh(geometry,day);
  }
  mesh.userData = { textureFree:true, dayMaterial:day, nightMaterial:night };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
export function createWeinbergPlaygroundV174(): Group { return create(false); }
export function createMinecraftWeinbergPlaygroundV174(): Group { return create(true); }
