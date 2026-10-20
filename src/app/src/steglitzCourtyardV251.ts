import source from "./data/steglitzCourtyardV251.json";
import original from "./data/steglitzV182Source.json";
import native from "./data/steglitzV182Native.json";
import previous from "./data/steglitzSchoolV250.json";
import {
  steglitzSchoolV250Enabled, steglitzSchoolV250Fingerprint,
  steglitzSchoolV250SourceBoxes, steglitzSchoolV250NativeRows, steglitzSchoolV250SurfaceColor,
} from "./steglitzSchoolV250";

type Row = number[];
type Entry = {owner:string;boxes:Row[];rods:Row[];nativeRows:Row[]};
type Inputs = Record<keyof typeof source.fingerprints, unknown>;

export function verifySteglitzCourtyardV251Receipt(inputs:Inputs):boolean {
  try {
    return (Object.keys(source.fingerprints) as (keyof Inputs)[]).every(
      key=>steglitzSchoolV250Fingerprint(inputs[key])===source.fingerprints[key],
    );
  } catch { return false; }
}
let verified:boolean|undefined;
/** Atomic all-or-none correction. Only the boolean survives constructor work. */
export function steglitzCourtyardV251Enabled():boolean {
  if(verified===undefined) verified=steglitzSchoolV250Enabled()&&verifySteglitzCourtyardV251Receipt({
    sourceBoxes:original.boxes,sourceSurfaces:original.surfaces,nativeRows:native.boxes,v250:previous,
  });
  return verified;
}

/** Pass ORIGINAL v182 rows: v250 filtering runs here without shifting receipts. */
export function steglitzCourtyardV251SourceBoxes(rows:Row[]):Row[] {
  const baseline=steglitzSchoolV250SourceBoxes(rows);
  if(!steglitzCourtyardV251Enabled()) return baseline;
  const obsolete=new Set(source.removeSourceBoxes.map(index=>rows[index]));
  return baseline.filter(row=>!obsolete.has(row));
}

/** Every native occupied cell and all its dimensions remain byte-identical. */
export function steglitzCourtyardV251NativeRows(rows:Row[]):Row[] {
  const baseline=steglitzSchoolV250NativeRows(rows);
  if(!steglitzCourtyardV251Enabled()) return baseline;
  const paints=new Map(source.nativeColors.map(r=>[r[0],r[1]]));
  return baseline.map((r,i)=>paints.has(i)?[...r.slice(0,6),paints.get(i)!]:r);
}
export function steglitzCourtyardV251SurfaceColor(index:number,originalColor:number):number {
  const baseline=steglitzSchoolV250SurfaceColor(index,originalColor);
  return steglitzCourtyardV251Enabled()?source.surfaceColors.find(r=>r[0]===index)?.[1]??baseline:baseline;
}

/** Extend the existing v205 batch AFTER v250 substitution. No new root or mesh. */
export function appendSteglitzCourtyardV251<T extends Entry>(entry:T):T {
  if(entry.owner!==source.owner||!steglitzCourtyardV251Enabled()) return entry;
  const decode=(rows:Row[],rod=false):Row[]=>rows.map(row=>row.map((v,i)=>{
    if(i===row.length-1) return source.palette[v];
    if(i<(rod?7:6)) return v/100+(i<(rod?6:3)?source.origin[i%3]:0);
    return v/10000;
  }));
  return {...entry,boxes:[...entry.boxes,...decode(source.boxes)],
    rods:[...entry.rods,...decode(source.rods,true)],
    nativeRows:[...entry.nativeRows,...decode(source.nativeRows)]};
}
