import {Color,InstancedMesh,Matrix4,Object3D,Vector3} from "three";

export type QuarterLegacyReceiptV303={owner:string;requiredPacketKeys:string[];native:boolean;expectedCount:number;rows:{index:number;row:number[]}[]};
type Entry={receipt:QuarterLegacyReceiptV303;before:Float32Array[];hidden:Float32Array[];masked:boolean};
const entries=new WeakMap<InstancedMesh,Entry[]>();
const matrixFor=(row:readonly number[],native:boolean)=>{const m=new Matrix4();if(native)m.makeScale(row[3],row[4],row[5]);else m.makeRotationY(row[6]).scale(new Vector3(row[3],row[4],row[5]));m.setPosition(row[0],row[1],row[2]);return new Float32Array(m.elements);};
const equals=(array:ArrayLike<number>,at:number,row:Float32Array)=>row.every((n,i)=>array[at+i]===n);
function snapshot(input:QuarterLegacyReceiptV303):QuarterLegacyReceiptV303|undefined{
  if(!input||typeof input.owner!=="string"||!input.owner||typeof input.native!=="boolean"||!Number.isSafeInteger(input.expectedCount)||input.expectedCount<1||
    !Array.isArray(input.requiredPacketKeys)||!input.requiredPacketKeys.length||input.requiredPacketKeys.length>512||new Set(input.requiredPacketKeys).size!==input.requiredPacketKeys.length||input.requiredPacketKeys.some(k=>typeof k!=="string"||!k.startsWith(input.native?"minecraft:":"drawn:")||!k.split(":")[1])||
    !Array.isArray(input.rows)||!input.rows.length||input.rows.length>input.expectedCount||new Set(input.rows.map(r=>r?.index)).size!==input.rows.length||input.rows.some(r=>!r||!Number.isSafeInteger(r.index)||r.index<0||r.index>=input.expectedCount||!Array.isArray(r.row)||r.row.length!==(input.native?7:8)||!r.row.every(Number.isFinite)||r.row.slice(3,6).some(n=>n<=0)||!Number.isSafeInteger(r.row[input.native?6:7])||r.row[input.native?6:7]<0||r.row[input.native?6:7]>0xffffff))return undefined;
  const rows=input.rows.map(r=>Object.freeze({index:r.index,row:Object.freeze(r.row.slice()) as unknown as number[]}));
  return Object.freeze({owner:input.owner,native:input.native,expectedCount:input.expectedCount,requiredPacketKeys:Object.freeze(input.requiredPacketKeys.slice()) as unknown as string[],rows:Object.freeze(rows) as unknown as QuarterLegacyReceiptV303["rows"]});
}

/** Restore on eviction, cancellation or mode change. Only the exact obsolete
 * shallow profiles yield, after every owner packet is actually published.
 * Original batch slots, every foreign instance and all source rows survive. */
export function syncQuarterLegacyFittingsV303(root:Object3D,published:ReadonlySet<string>,receipts:readonly QuarterLegacyReceiptV303[]):number{
  let changed=0;
  root.traverse(object=>{
    if(!(object instanceof InstancedMesh))return;
    // This public semantic owner is set by both original v185 constructors.
    const parent=object.parent;
    if(parent?.userData.frontageCount!==113||parent.userData.mappedBenchCount!==39)return;
    const native=object.userData.blockNative===true;
    let owned=entries.get(object);
    if(!owned){
      owned=[];const matrix=object.instanceMatrix.array,colors=object.instanceColor?.array;
      if(!colors)return;
      const candidates:Entry[]=[];
      for(const input of receipts){
        const receipt=snapshot(input);
        if(!receipt||receipt.native!==native||receipt.expectedCount!==object.count)continue;
        const before=receipt.rows.map(r=>matrixFor(r.row,native));
        const tint=new Color();
        if(receipt.rows.some((r,i)=>!Number.isSafeInteger(r.index)||r.index<0||r.index>=object.count||!equals(matrix,r.index*16,before[i])||!equals(colors,r.index*3,new Float32Array(tint.setHex(r.row[native?6:7]).toArray()))))continue;
        const hidden=before.map(r=>{const h=r.slice();h.fill(0,0,12);return h;});
        candidates.push({receipt,before,hidden,masked:false});
      }
      // Ambiguous duplicate/overlapping source receipts keep every old slot.
      const usage=new Map<number,number>();for(const e of candidates)for(const r of e.receipt.rows)usage.set(r.index,(usage.get(r.index)??0)+1);
      owned=candidates.filter(e=>e.receipt.rows.every(r=>usage.get(r.index)===1));
      entries.set(object,owned);
    }
    let dirty=false;
    for(const entry of owned){
      const mask=entry.receipt.requiredPacketKeys.every(k=>published.has(k));
      if(mask===entry.masked)continue;
      const matrix=object.instanceMatrix.array;
      const expected=entry.masked?entry.hidden:entry.before;
      if(entry.receipt.rows.some((r,i)=>!equals(matrix,r.index*16,expected[i])))continue;
      // Assigning this exact backing first leaves lossless immutable parking
      // before mutation. A pending old retirement cannot detach writable rows.
      object.instanceMatrix.needsUpdate=true;
      const writable=object.instanceMatrix.array;
      entry.receipt.rows.forEach((r,i)=>(writable as Float32Array).set((mask?entry.hidden:entry.before)[i],r.index*16));
      entry.masked=mask;dirty=true;changed+=entry.receipt.rows.length;
    }
    if(dirty)object.instanceMatrix.needsUpdate=true;
  });
  return changed;
}
