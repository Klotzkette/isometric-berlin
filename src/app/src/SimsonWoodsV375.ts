import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { markGroundFinishV348 } from "./GroundFinishV348";
import woodland from "./data/simsonWoodsV375.json";

export const SIMSON_WOODS_V375 = "Mapped woodland floor beside the Simsonweg v375";

function words(text: string): Uint16Array {
  const bytes = gunzipSync(decodeBase64Bytes(text));
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

/** The exact wooded patches use the original park colour and draped-ground lift. */
export function createSimsonWoodsV375(terrainAt: (x:number,z:number)=>number): Mesh {
  const source = words(woodland.vertices), positions = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 3) {
    const x = source[i]/100, z = source[i+1]/100;
    positions[i] = x;
    positions[i+1] = terrainAt(x,z) + .06;
    positions[i+2] = z;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position",new BufferAttribute(positions,3));
  geometry.setIndex(new BufferAttribute(words(woodland.indices),1));
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({color:0xa9c592});
  const night = new MeshBasicMaterial({color:0x1c2a20});
  const mesh = new Mesh(geometry,day);
  mesh.name = SIMSON_WOODS_V375;
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  markGroundFinishV348(mesh,"grass");
  return mesh;
}
