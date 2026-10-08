import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import source from "./data/airportsV194.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const AIRPORTS_V194_PROFILE = {
  bounds: [-7070.83,-4907.25,1791.74,4671.61],
  budgetBytes: 1_800_000,
  cameras: {
    tegel: {position:[-5600,1100,-3000],target:[-5520,3,-4550],spanM:3400},
    terminal: {position:[-5050,180,-3740],target:[-5412,14,-4078],spanM:700},
    tempelhof: {position:[2200,600,4900],target:[1250,20,4200],spanM:1500},
    entrance: {position:[1020,48,3970],target:[1097,17,4063],spanM:160},
  },
} as const;

/** Complete source Tempelhof envelope; independently authored former TXL forms. */
export function createAirportsV194(native = false): Group {
  const root=new Group();root.name="Former Tempelhof and Tegel airports: source geometry v194";
  root.userData={airportsV194:true,textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,keepInMinecraft:native,sourceGeometryRetained:true};
  if(!native) {
    const count=source.surfaces.reduce((n,s)=>n+s.triangles.length*9,0);
    const positions=new Float32Array(count),colors=new Float32Array(count),color=new Color();let offset=0;
    for(const s of source.surfaces) {
      color.setHex(s.color);
      for(const t of s.triangles)for(const p of t){positions.set(p,offset);color.toArray(colors,offset);offset+=3;}
    }
    const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(positions,3));geometry.setAttribute("color",new BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9});
    const mesh=new Mesh(geometry,day);mesh.name="Complete measured terminal sheets and mapped former runway strips";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);
  }
  const detail=justicePalaceV183Boxes(native?source.blocks:source.boxes,native);
  detail.name=native?"Separate airport exterior lattice and native runway bands":"Bounded airport facade divisions and indicative runway dashes";
  root.add(detail);return freezeStaticSceneTransforms(root);
}
