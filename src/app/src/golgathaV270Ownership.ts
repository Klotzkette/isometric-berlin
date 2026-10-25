import previous from './data/golgathaV270Previous.json';
import colours from './data/golgathaV270Colours.json';
import {applyAltMitteAppearanceV213, type AltMitteAppearanceSourceV213} from './altMitteAppearanceV213';
import {transferExactPacketLines,transferExactPacketTriangles} from './exactPacketTransfer';
import type {SurroundingPackedLines,SurroundingPackedMesh} from './SurroundingCityGeometry';

const triangleTiles=new Set(previous.records.map(r=>r.tile));
const lineTiles=new Set(previous.lineRecords.map(r=>r.tile));

/** Exact owner/material incident-face receipts change colour cells only. Call
 * after earlier generic appearance recipes; all topology and source bytes stay. */
export function* applyGolgathaColoursV270(enabled:boolean,tile:string,native:boolean,part:SurroundingPackedMesh,meshIndex:number,vertices:Uint16Array,vertexOffset:number,vertexCount:number):Generator<void,number>{
 if(!enabled)return 0;
 return yield* applyAltMitteAppearanceV213(tile,native,part,meshIndex,vertices,vertexOffset,vertexCount,colours as AltMitteAppearanceSourceV213);
}

/** Narrow immutable-payload transfer; changed source payloads remain visible. */
export function* transferGolgathaTrianglesV270(enabled:boolean,tile:string,native:boolean,part:SurroundingPackedMesh,indices:Uint16Array|Uint32Array,offset:number):Generator<void,number>{
 if(!enabled||part.kind!=='alt-mitte-v169'||!triangleTiles.has(tile))return 0;
 return yield* transferExactPacketTriangles(previous.records,tile,native,part,indices,offset);
}

export function* transferGolgathaLinesV270(enabled:boolean,tile:string,part:SurroundingPackedLines,values:Uint16Array,stride:number):Generator<void,number>{
 if(!enabled||!lineTiles.has(tile))return 0;
 return yield* transferExactPacketLines(previous.lineRecords,tile,part,values,stride);
}

type Part={id:string;sourceId?:string;ring:readonly (readonly number[])[];holes:readonly (readonly (readonly number[])[])[];groundY:number;topY:number};
const tuple=(p:Part)=>JSON.stringify([p.id,p.sourceId,p.ring,p.holes,p.groundY,p.topY]);
const original=tuple(previous.previousNavigationPart);
export function isGolgathaPreviousPartV270(part:Part):boolean{
 return part.id===previous.part&&tuple(part)===original;
}
