import { BufferAttribute, Color } from "three";
import data from "./data/tegelLandscapeShoreV378.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import type { ShoreUpdateV378 } from "./tegelLandscapeShoreLinkV378";

export const applyTegelShoreV378: ShoreUpdateV378 = (mesh,source,native) => {
  const table = native ? data.native : data.drawn;
  const drop = new Uint32Array(decodeBase64Bytes(table.drop).buffer);
  const extra = new Uint16Array(decodeBase64Bytes(table.indices).buffer);
  const xyz = new Int32Array(decodeBase64Bytes(table.points).buffer);
  const colors = decodeBase64Bytes(table.tint);
  const palette = table.palette.map(color=>new Color(color));
  const old = mesh.geometry, oldPoints=old.getAttribute("position"), oldColors=old.getAttribute("color");
  const oldCount=oldPoints.count;
  const points=new Float32Array(oldCount*3+xyz.length), tint=new Float32Array(points.length);
  points.set(oldPoints.array); tint.set(oldColors.array);
  for (let i=0;i<colors.length;i++) {
    const at=3*(oldCount+i);
    points[at]=xyz[i*3]/100-8192;points[at+1]=xyz[i*3+1]/100;points[at+2]=xyz[i*3+2]/100-7168;
    palette[colors[i]].toArray(tint,at);
  }
  const total=source.indices.length-drop.length*3+extra.length;
  const indices=points.length/3>=65536 ? new Uint32Array(total) : new Uint16Array(total);
  let at=0,cut=0;
  for (let i=0;i<source.indices.length;i+=3) {
    if (cut<drop.length && i===drop[cut]*3) {cut++;continue;}
    indices[at++]=source.indices[i];indices[at++]=source.indices[i+1];indices[at++]=source.indices[i+2];
  }
  for (const vertex of extra) indices[at++]=oldCount+vertex;
  old.dispose();
  old.setIndex(new BufferAttribute(indices,1));old.setAttribute("position",new BufferAttribute(points,3));
  old.setAttribute("color",new BufferAttribute(tint,3));old.deleteAttribute("normal");
  old.computeVertexNormals();old.computeBoundingBox();old.computeBoundingSphere();
  mesh.userData.surveyedBeachShoreFacesV378=drop.length;
};
