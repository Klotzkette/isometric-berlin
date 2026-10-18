import source from "./data/spreeFacadesV231Ownership.json";
import { applyAltMitteAppearanceV213, type AltMitteAppearanceSourceV213 } from "./altMitteAppearanceV213";
import { transferExactPacketTriangles } from "./exactPacketTransfer";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";

/** Nine exact facade recipes only. All measured shells/ink/nav remain. */
export function* transferSpreeFacadeV231(tile:string,native:boolean,part:SurroundingPackedMesh,indices:Uint16Array|Uint32Array,offset:number):Generator<void,number> {
 if(native || part.kind!=="alt-mitte-v169")return 0;
 return yield* transferExactPacketTriangles(source.records,tile,false,part,indices,offset);
}
/** Call after v213 appearance. The exact source face colours change in either mode;
 * positions, indices, neighbouring faces and the whole envelope are preserved. */
export function* applySpreeFacadeColoursV231(tile:string,native:boolean,part:SurroundingPackedMesh,mesh:number,vertices:Uint16Array,vertexOffset:number,count:number):Generator<void,number> {
 return yield* applyAltMitteAppearanceV213(tile,native,part,mesh,vertices,vertexOffset,count,source.appearance as AltMitteAppearanceSourceV213);
}
