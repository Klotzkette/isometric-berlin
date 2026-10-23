import previous from "./data/chariteBridgesV265AltMittePrevious.json";
import { transferExactPacketLines, transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedLines, SurroundingPackedMesh } from "./SurroundingCityGeometry";

const triangleTiles=new Set(previous.records.map(r=>r.tile));
const lineTiles=new Set(previous.lineRecords.map(r=>r.tile));

/** Enabled only when the new bridges and both unchanged native neighbours exist.
 * A changed payload fingerprint retains its original geometry. */
export function* transferChariteBridgeTrianglesV265(
  enabled:boolean,tile:string,native:boolean,part:SurroundingPackedMesh,
  indices:Uint16Array|Uint32Array,offset:number,
):Generator<void,number>{
  if(!enabled||part.kind!=="alt-mitte-v169"||!triangleTiles.has(tile))return 0;
  return yield* transferExactPacketTriangles(previous.records,tile,native,part,indices,offset);
}

export function* transferChariteBridgeLinesV265(
  enabled:boolean,tile:string,part:SurroundingPackedLines,values:Uint16Array,stride:number,
):Generator<void,number>{
  if(!enabled||!lineTiles.has(tile))return 0;
  return yield* transferExactPacketLines(previous.lineRecords,tile,part,values,stride);
}

type Part={id:string;sourceId?:string;ring:readonly (readonly number[])[];holes:readonly (readonly (readonly number[])[])[];groundY:number;topY:number};
const tuple=(p:Part)=>JSON.stringify([p.id,p.sourceId,p.ring,p.holes,p.groundY,p.topY]);
/** Only the two bridge navigation leaves change. The two neighbours remain. */
export function isChariteBridgePreviousPartV265(part:Part):boolean{
  return previous.previousNavigationParts.some(p=>p.id===part.id&&tuple(p)===tuple(part));
}
