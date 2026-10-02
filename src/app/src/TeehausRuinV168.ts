import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Uint8BufferAttribute, Vector3 } from "three";
import source from "./data/teehausRuinV168Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const TEEHAUS_RUIN_V168_GROUP = "English Garden Teehaus documented post-fire ruin";
export const TEEHAUS_RUIN_V168_NATIVE_GROUP = "English Garden Teehaus independent native ruin";
function materials(vertexColors = false) {
  return {
    dayMaterial: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    nightMaterial: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .97, flatShading: true }),
    textureFree: true,
  };
}
function blocks(rows: readonly number[][], native: boolean): InstancedMesh {
  const geometry = new BoxGeometry(1,1,1); geometry.deleteAttribute("uv");
  const mat = materials(), mesh = new InstancedMesh(geometry, mat.dayMaterial, 0);
  const matrices = new Float32Array(rows.length*16), colors = new Float32Array(rows.length*3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  rows.forEach((r,i) => {
    matrix.makeRotationY(native ? 0 : r[6]); matrix.scale(scale.set(r[3],r[4],r[5])); matrix.setPosition(r[0],r[1],r[2]); matrix.toArray(matrices,i*16);
    color.setHex(r[native ? 6 : 7]).toArray(colors,i*3);
  });
  mesh.count=rows.length; mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16); mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.userData={...mat,blockNative:native}; mesh.computeBoundingBox(); mesh.computeBoundingSphere();return mesh;
}
function create(native: boolean): Group {
  const root=new Group();root.name=native?TEEHAUS_RUIN_V168_NATIVE_GROUP:TEEHAUS_RUIN_V168_GROUP;
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,documentedState:source.state,sourceParts:source.parts.map(p=>p.id),rooflessInterior:true};
  if(native)root.add(blocks(source.nativeRows,true));
  else {
    const n=source.surfaces.reduce((n,s)=>n+s.triangles.length*9,0),positions=new Float32Array(n),colors=new Uint8Array(n),color=new Color();let i=0;
    for(const s of source.surfaces){color.setHex(s.color);for(const t of s.triangles)for(const p of t){positions.set(p,i);colors.set([Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255)],i);i+=3;}}
    const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("color",new Uint8BufferAttribute(colors,3,true));geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mat=materials(true),mesh=new Mesh(geometry,mat.dayMaterial);mesh.userData=mat;mesh.name="Surveyed surviving Teehaus walls and sky-open ruined interior";
    root.add(mesh,blocks(source.boxes.map(r=>r.slice(0,8).map(Number)),false));
  }
  return freezeStaticSceneTransforms(root);
}
export function createTeehausRuinV168(_options:{mobileLike?:boolean}={}):Group{return create(false);}
export function createMinecraftTeehausRuinV168(_options:{mobileLike?:boolean}={}):Group{return create(true);}
