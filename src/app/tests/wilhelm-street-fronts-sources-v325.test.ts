import{expect,test}from'bun:test';
import{readFileSync}from'node:fs';
import data from'../src/data/wilhelmStreetFrontsV325Sources.json';
import{bindWilhelmStreetFrontsSourcesV325Steps,hasWilhelmStreetFrontsSourcesV325 as valid}from'../src/WilhelmStreetFrontsV325Sources';
const root=new URL('../../../',import.meta.url),read=(p:string)=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const buildings=read('src/app/public/mesh/regierungsviertel/lod2-prisms.json').buildings,voxels=read('src/app/public/mesh/regierungsviertel/minecraft-voxels.json');
const core={minecraftChunks:data.nativePackets.map(p=>({id:p.id,packet:read(p.file)}))};
function finish<T>(g:Generator<void,T>):T{let n=g.next();while(!n.done)n=g.next();return n.value;}
const bind=(rows:readonly unknown[]=buildings,source:unknown={core,voxels},native=false)=>finish(bindWilhelmStreetFrontsSourcesV325Steps(rows,source,native));
const fresh=()=>({core:structuredClone(core),voxels:{...voxels,building_rows:voxels.building_rows.map((r:number[][])=>r.map(w=>[...w]))}});
test('all87 original rows, full8 native packets and1395 full-interval/exposure cells admit both readings',()=>{
 expect(data.prisms).toHaveLength(87);expect(data.nativePackets).toHaveLength(8);expect(data.nativeVoxels.cells).toHaveLength(1395);expect(data.nativeVoxels.cells.filter(c=>c.intervals.length===0)).toHaveLength(613);
 const a=bind(),b=bind(buildings,{core,voxels},true);expect(a).not.toBeNull();expect(b).not.toBeNull();expect(valid(a,false)).toBe(true);expect(valid(b,true)).toBe(true);expect(valid(a,true)).toBe(false);expect(valid(b,false)).toBe(false);expect(valid({...a})).toBe(false);expect(valid({source:true})).toBe(false);
});
test('Drawn never reads optional Native input; Native requires actual voxel and core families',()=>{
 let reads=0;const hostile={};Object.defineProperty(hostile,'core',{get(){reads++;throw Error('unread')}});expect(bind(buildings,hostile,false)).not.toBeNull();expect(reads).toBe(0);expect(bind(buildings,hostile,true)).toBeNull();expect(reads).toBe(0);
 for(const input of[null,core,{core},{voxels},{core,voxels:{...voxels,cell_m:8}}])expect(bind(buildings,input,true)).toBeNull();
});
test('missing, duplicate, corrupt or accessor owners reject without evaluating accessors',()=>{
 const index=buildings.findIndex((p:any)=>p.id===data.prisms[0].id);expect(bind(buildings.filter((_:unknown,i:number)=>i!==index))).toBeNull();expect(bind([...buildings,buildings[index]])).toBeNull();
 const changed=[...buildings];changed[index]={...changed[index],h_dm:changed[index].h_dm+1};expect(bind(changed)).toBeNull();let reads=0;const getter={...buildings[index]};Object.defineProperty(getter,'ring',{enumerable:true,get(){reads++;return buildings[index].ring}});changed[index]=getter;expect(bind(changed)).toBeNull();expect(reads).toBe(0);
});
test('live row words, identity, descriptors and added properties revoke source proof',()=>{
 for(const mode of['word','ref','descriptor','extra']as const){const rows=buildings.map((p:any)=>data.prisms.some(s=>s.id===p.id)?structuredClone(p):p),index=rows.findIndex((p:any)=>p.id===data.prisms[0].id),receipt=bind(rows);expect(valid(receipt)).toBe(true);if(mode==='word')rows[index].ring[0][0]++;if(mode==='ref')rows[index]=structuredClone(rows[index]);if(mode==='descriptor')Object.defineProperty(rows[index],'h_dm',{value:rows[index].h_dm,enumerable:true,writable:false,configurable:true});if(mode==='extra')rows[index].foreign=true;expect(valid(receipt)).toBe(false);}
});
test('complete Native packet words and membership reject corruption, duplication and replacement',()=>{
 for(const kind of['word','duplicate','missing','liveword','liveref']as const){const s=fresh();if(kind==='word')s.core.minecraftChunks[0].packet.meshes[0].positions='AAAA'+s.core.minecraftChunks[0].packet.meshes[0].positions.slice(4);if(kind==='duplicate')s.core.minecraftChunks.push(s.core.minecraftChunks[0]);if(kind==='missing')s.core.minecraftChunks.shift();const receipt=bind(buildings,s,true);if(kind.startsWith('live')){expect(valid(receipt,true)).toBe(true);if(kind==='liveword')s.core.minecraftChunks[0].packet.meshes[0].colors='AAAA'+s.core.minecraftChunks[0].packet.meshes[0].colors.slice(4);else s.core.minecraftChunks[0].packet=structuredClone(s.core.minecraftChunks[0].packet);expect(valid(receipt,true)).toBe(false);}else expect(receipt).toBeNull();}
});
test('selected full intervals, empty cells and full RLE row topology remain exact',()=>{
 const cell=data.nativeVoxels.cells.find(c=>c.intervals.length)!,empty=data.nativeVoxels.cells.find(c=>!c.intervals.length)!;
 for(const mode of['height','duplicate','emptyInsert','liveheight','livetopology','liveref']as const){const s=fresh(),z=cell.z-data.nativeVoxels.grid.min_z_idx,row=s.voxels.building_rows[z],index=row.findIndex((r:number[])=>cell.x>=data.nativeVoxels.grid.min_x_idx+r[0]&&cell.x<data.nativeVoxels.grid.min_x_idx+r[0]+r[1]);if(mode==='height')row[index][3]++;if(mode==='duplicate')row.push([...row[index]]);if(mode==='emptyInsert')s.voxels.building_rows[empty.z-data.nativeVoxels.grid.min_z_idx].push([empty.x-data.nativeVoxels.grid.min_x_idx,1,0,1,0]);const receipt=bind(buildings,s,true);if(mode.startsWith('live')){expect(valid(receipt,true)).toBe(true);if(mode==='liveheight')row[index][3]++;if(mode==='liveref')s.voxels.building_rows[z]=row.map((r:number[])=>[...r]);if(mode==='livetopology')row.push([99999,1,0,1,0]);expect(valid(receipt,true)).toBe(false);}else expect(receipt).toBeNull();}
});
test('a private receipt does not retain the full original prism container',async()=>{
 const item=(()=>{const rows=structuredClone([...data.prisms,...data.contributorPrisms]);return{weak:new WeakRef(rows),receipt:bind(rows)}})();expect(item.receipt).not.toBeNull();for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,0));Bun.gc(true);}expect(item.weak.deref()===undefined).toBe(true);expect(valid(item.receipt,false)).toBe(false);
});

test('Drawn also binds every actual foreign contributor before admitting new street fields',()=>{
 expect(data.contributorPrisms).toHaveLength(27);
 const target=data.contributorPrisms[0],rows=buildings.map((p:any)=>p.id===target.id?structuredClone(p):p),index=rows.findIndex((p:any)=>p.id===target.id);
 const receipt=bind(rows);expect(valid(receipt,false)).toBe(true);rows[index].h_dm++;expect(valid(receipt,false)).toBe(false);
 expect(bind(buildings.filter((p:any)=>p.id!==target.id))).toBeNull();
});

test('Native receipts do not retain full voxel or core chunk containers',async()=>{
 const item=(()=>{const s=fresh();return{rows:new WeakRef(s.voxels.building_rows),chunks:new WeakRef(s.core.minecraftChunks),receipt:bind(buildings,s,true)}})();expect(item.receipt).not.toBeNull();for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,0));Bun.gc(true);}expect(item.rows.deref()===undefined).toBe(true);expect(item.chunks.deref()===undefined).toBe(true);expect(valid(item.receipt,true)).toBe(false);
});
