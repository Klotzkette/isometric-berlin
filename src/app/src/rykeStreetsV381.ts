import { Group, InstancedBufferAttribute, InstancedMesh } from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { addSurveyTreesV380, createSurveySurfaceV380, type PrenzlauerStreetPacketV380 } from "./prenzlauerStreetsV380";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

// Trunks and crowns keep the existing geometry, transforms and colours. Each
// contiguous 128 m part has its own frustum bound. Typed-array slices share
// the original backing stores and are uploaded only when their part is drawn.
function groupTrees(root: Group, trees: number[][]) {
  const ranges: [number,number][]=[];
  let previous="";
  for (let i=0;i<trees.length;i++) {
    const cell=Math.floor(trees[i][0]/128)+"_"+Math.floor(trees[i][1]/128);
    if (cell!==previous) ranges.push([i,0]);
    ranges[ranges.length-1][1]++;
    previous=cell;
  }
  if (ranges.length<2) return;
  for (const original of [...root.children]) {
    if (!(original instanceof InstancedMesh)) continue;
    const perTree=original.count/trees.length;
    if (!Number.isInteger(perTree)) throw Error("Uneinheitliche Baumgeometrie im Kollwitzkiez");
    root.remove(original);
    for (const [start,length] of ranges) {
      const first=start*perTree, end=(start+length)*perTree;
      const mesh=new InstancedMesh(original.geometry,original.material,0);
      mesh.count=end-first;
      mesh.name=original.name;
      mesh.userData={...original.userData};
      mesh.instanceMatrix=new InstancedBufferAttribute(original.instanceMatrix.array.subarray(first*16,end*16),16);
      if (original.instanceColor) {
        mesh.instanceColor=new InstancedBufferAttribute(original.instanceColor.array.subarray(first*3,end*3),3);
      }
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
  }
}

/** Same Berlin paving palette and instanced municipal-tree representation as
 * the adjoining Kastanienallee. The two park interiors have separate owners. */
export function createRykeStreetsV381(packet: PrenzlauerStreetPacketV380, native: boolean) {
  const group=new Group();
  group.name="Rykestraße, Knaackstraße und Straßen am Kollwitzplatz";
  group.userData={rykeStreetsV381:true,rykeStreetTrees:packet.trees.length,nativeMinecraft:native,keepInMinecraft:native};
  group.add(createSurveySurfaceV380(packet,"Vermessene Fahrbahnen, Bordsteine und Gehwege im Kollwitzkiez"));
  addSurveyTreesV380(group,packet.trees,native);
  groupTrees(group,packet.trees);
  return group;
}

export async function attachRykeStreetsV381(entry: SurroundingChunkGeometry, id:string, native:boolean, signal?:AbortSignal) {
  signal?.throwIfAborted();
  const tile=id.slice("ryke381-".length);
  const {default:data}=await import(`./data/rykeStreetsV381/${tile}.json`) as {default:PrenzlauerStreetPacketV380};
  signal?.throwIfAborted();
  attachWorldSpaceDetail(entry,createRykeStreetsV381(data,native));
}
