import source from "./data/gipsKoppenV252.json";

type Rows = number[][];
type Label = {text:string;center:number[];direction:number[];normal:number[];height:number;color:number};
type Entry = {owner:string;boxes:Rows;rods:Rows;nativeRows:Rows;labels:Label[]};

/** Exact authored numeric rows, independently seeded; never source buildings. */
export function gipsKoppenV252Fingerprint(rows: readonly number[][]): number[] {
  let a=2166136261,b=5381;
  const feed=(text:string):void=>{
    for(let i=0;i<text.length;i++){
      a=Math.imul(a^text.charCodeAt(i),16777619)>>>0;
      b=(Math.imul(b,33)^text.charCodeAt(i))>>>0;
    }
  };
  rows.forEach((r,i)=>{
    if(i)feed(";");
    r.forEach((v,j)=>{if(j)feed(",");feed(v.toFixed(6));});
  });
  return [rows.length,a,b];
}

export function gipsKoppenV252Matches(entry:Entry):boolean {
  return entry.owner===source.owner && (["boxes","rods","nativeRows"] as const).every(key=>{
    const actual=gipsKoppenV252Fingerprint(entry[key]);
    return actual.every((v,i)=>v===source.previous[key][i]);
  });
}

/** Extend the existing nearby school batch: no extra mesh or material.
 * Replace only the exact six-storey v205 authored main-school estimate with
 * the complete four-storey reading, retaining all source body/roof packets. */
export function appendGipsKoppenV252<T extends Entry>(entry:T):T {
  if(!gipsKoppenV252Matches(entry)) return entry;
  const decode=(rows:Rows,kind:"boxes"|"rods"|"nativeRows"):Rows=>rows.map(r=>r.map((v,i)=>{
    if(i===r.length-1)return source.palette[v];
    if(i<(kind==="rods"?7:6))return v/1000+(i<(kind==="rods"?6:3)?source.origin[i%3]:0);
    return v/1e6;
  }));
  return {...entry,boxes:decode(source.boxes,"boxes"),rods:decode(source.rods,"rods"),
    nativeRows:decode(source.nativeRows,"nativeRows"),labels:[...entry.labels,...source.labels]};
}
