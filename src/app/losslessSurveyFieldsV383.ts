import { gzipSync } from "node:zlib";

export const surveyLayoutsV383: Readonly<Record<string,Readonly<Record<string,readonly [number,boolean]>>>> = {
  "roadGroundV343.json": {cells_u32:[24,true],triangles_f32:[4,false],edges_f32:[8,true]},
  "mittePlazaEdgesV367.json": {words:[4,false]},
};

/** Keep every stored byte. Repeated exponents, leading zeroes and stable
 * street-edge components compress better together than inside base64 quartets. */
export function encodeSurveyFieldV383(value:string, layout:readonly [number,boolean]) {
  const raw=Buffer.from(value,"base64");
  const [width,delta]=layout;
  // A later packet with a different layout or spelling keeps the generic string path.
  if (raw.length===0 || raw.length>4_000_000 || raw.length%width || raw.toString("base64")!==value) return undefined;
  const planes=Buffer.allocUnsafe(raw.length);
  let j=0;
  for(let lane=0;lane<width;lane++){
    let previous=0;
    for(let i=lane;i<raw.length;i+=width){
      const byte=raw[i];
      planes[j++]=delta ? byte^previous : byte;
      previous=byte;
    }
  }
  const compressed=gzipSync(planes,{level:9});
  // Match the existing source encoder's cross-platform gzip metadata.
  compressed[9]=0x13;
  if (compressed.length*4/3>=value.length*.8) return undefined;
  return [compressed.toString("base64"),raw.length,width,delta] as const;
}
