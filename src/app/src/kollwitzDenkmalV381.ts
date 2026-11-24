import { DoubleSide, Group, Mesh, MeshStandardMaterial } from "three";
import data from "./data/kollwitzDenkmalV381.json";
import { createMeasuredPlaceGeometry } from "./measuredPlaceGeometryV381";

type PriorSite = {key:string; owner:string; boxes:number[][]; nativeRows:number[][]};
const verified = new WeakMap<PriorSite,boolean>();

function matches(site:PriorSite):boolean {
  if (site.key!=="kollwitzplatz"||site.owner!=="OSM-way-24638848") return false;
  const cached=verified.get(site);
  if (cached!==undefined) return cached;
  const tails=[["boxes",167],["nativeRows",923]] as const;
  const ok=tails.every(([field,start])=>{
    const original=data.old[field],rows=site[field];
    return rows.length===start+original.length&&original.every((r,i)=>{
      const actual=rows[start+i];
      return r.length===actual.length&&r.every((v,j)=>v===actual[j]);
    });
  });
  verified.set(site,ok);
  return ok;
}

/** Retire only the eleven original boxes and their exact native subdivisions. */
export function refineKollwitzDenkmalV381<T extends PriorSite>(site:T):T {
  return matches(site)?{...site,boxes:site.boxes.slice(0,167),nativeRows:site.nativeRows.slice(0,923)}:site;
}

export function appendKollwitzDenkmalV381(group:Group,site:PriorSite,native:boolean):void {
  if (!matches(site)||group.userData.kollwitzDenkmalV381) return;
  appendVerifiedKollwitzDenkmalV381(group,native);
}

export function appendVerifiedKollwitzDenkmalV381(group:Group,native:boolean):void {
  if (group.userData.kollwitzDenkmalV381) return;
  const packet=native?data.native:data.drawn;
  const g=createMeasuredPlaceGeometry(packet);
  g.computeVertexNormals();
  const day=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.81,metalness:.04,emissive:0x393e37,flatShading:native});
  const night=day.clone();night.emissive.setHex(0x13120e);
  const mesh=new Mesh(g,day);
  mesh.name="Käthe Kollwitz · Gustav Seitz";
  mesh.scale.setScalar(.01);mesh.position.fromArray(packet.origin);
  mesh.userData={...group.userData,siteKey:"kollwitzplatz",requiredBeforeNavigation:true,dayMaterial:day,nightMaterial:night,nativeMinecraft:native,keepInMinecraft:native};
  group.userData.kollwitzDenkmalV381=true;
  group.add(mesh);
}
