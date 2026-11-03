/** Lossless Float32 input bits, not a geometry or level-of-detail codec. */
import {decodeBase64Bytes} from "./decodeBase64Bytes";
export type HospitalRowsV308 = {
  codec: string; count: number; columns: string[];
};
export function decodeHospitalRowsV308(rows: HospitalRowsV308): Float32Array[] {
  if(rows.codec!=="f32-delta-zigzag-varint-columns-v1" ||
    !Number.isSafeInteger(rows.count)||rows.count<=0||rows.count>300000||rows.columns.length!==8) {
    throw Error("Invalid hospital v308 member columns");
  }
  return rows.columns.map(column=>{
    const bytes=decodeBase64Bytes(column),bits=new Uint32Array(rows.count);
    let offset=0,previous=0;
    for(let i=0;i<rows.count;i++){
      let value=0,shift=0,byte=0;
      do{
        if(offset>=bytes.length||shift>28)throw Error("Truncated hospital v308 column");
        byte=bytes[offset++];
        if(shift===28&&(byte&0xf0)!==0)throw Error("Overflowed hospital v308 delta");
        value=(value|((byte&127)<<shift))>>>0;shift+=7;
      }while(byte&128);
      previous=(previous+((value>>>1)^-(value&1)))>>>0;
      bits[i]=previous;
    }
    if(offset!==bytes.length)throw Error("Trailing hospital v308 column bytes");
    const result=new Float32Array(bits.buffer);
    if(result.some(v=>!Number.isFinite(v)))throw Error("Nonfinite hospital v308 member");
    return result;
  });
}
