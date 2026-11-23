import heights from "./data/zooWestV379Heights.json";
import {decodeBase64Bytes} from "./decodeBase64Bytes";
import {pointInWorldRing, type WorldRing} from "./chancelleryExtensionProfile";

type Field = {minX:number; minZ:number; width:number; height:number; ring:number[][]; dm:string};
const registered = Object.entries(heights).map(([id,raw]) => {
  const field: Field = raw;
  return {id,field,values:decodeBase64Bytes(field.dm)};
});

/** Identical measured coordinates and interpolation to the exported nave roof and three habitat floors. */
export function zooWestReliefHeightV379(x: number,z: number,native: boolean,roof: boolean): number | null {
  for (const {id,field,values} of registered) {
    if ((id === "DEBE01YYK0002NM4") !== roof ||
        x < field.minX-1 || x > field.minX+field.width || z < field.minZ-1 || z > field.minZ+field.height) continue;
    const sx=native ? (Math.floor(x/1.5)+.5)*1.5 : x;
    const sz=native ? (Math.floor(z/1.5)+.5)*1.5 : z;
    if (!pointInWorldRing(sx,sz,field.ring as unknown as WorldRing)) continue;
    const col=Math.max(0,Math.min(field.width-1.001,sx-field.minX));
    const row=Math.max(0,Math.min(field.height-1.001,sz-field.minZ));
    const i=Math.floor(col),j=Math.floor(row),u=col-i,v=row-j,o=j*field.width+i;
    const y=((1-v)*((1-u)*values[o]+u*values[o+1])+v*((1-u)*values[o+field.width]+u*values[o+field.width+1]))/10;
    return native ? Math.round(y*2)/2 : y;
  }
  return null;
}
