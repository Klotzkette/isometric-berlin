import {expect,test} from 'bun:test';
import {BufferAttribute,Group,Mesh} from 'three';
import {completePackedRootV307,createPackedRootV307,createPackedRootStepsV309,type RequiredPackedV307} from '../src/requiredPackedRootV307';
const bytes=(value:ArrayBufferView)=>Buffer.from(value.buffer,value.byteOffset,value.byteLength).toString('base64');
const owner=Symbol('cooperative source owner');
const row=(key:string):RequiredPackedV307=>({key,native:false,positionType:'f32',colorType:'u16linear',origin:[1,2,3],positions:bytes(new Float32Array([0,0,0,1,0,0,0,0,1])),indices:bytes(new Uint32Array([0,1,2])),colors:bytes(new Uint16Array([65535,1,0,0,2,65535,200,300,400])),vertices:3,triangles:1});
function dispose(root:Group){root.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();for(const material of new Set([object.userData.dayMaterial,object.userData.nightMaterial,object.userData.schwellenraumMaterial]))material?.dispose();}});root.clear();}
function snapshot(root:Group){return (root.children as Mesh[]).map(mesh=>({name:mesh.name,matrix:mesh.matrix.elements.slice(),attrs:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,a])=>[name,{count:a.count,itemSize:a.itemSize,normalized:a.normalized,bytes:bytes((a as BufferAttribute).array)}])),index:bytes(mesh.geometry.index!.array),materials:[mesh.userData.dayMaterial,mesh.userData.nightMaterial].map(m=>({type:m.type,color:m.color.toArray(),side:m.side,flatShading:m.flatShading,roughness:m.roughness}))}));}
test('cooperative packed construction yields every mesh and admits only the fully frozen ensemble',()=>{
 const rows=[row('one'),row('two'),row('three')],sync=createPackedRootV307(owner,'source',false,rows,{});let provisional:Group|undefined;
 const steps=createPackedRootStepsV309(owner,'source',false,rows,{},root=>{provisional=root;});
 try{for(let i=1;i<=rows.length;i++){expect(steps.next().done).toBe(false);expect(provisional!.children.length).toBe(i);expect(completePackedRootV307(provisional!,owner,false)).toBe(false);}const done=steps.next();expect(done.done).toBe(true);expect(done.value).toBe(provisional);expect(completePackedRootV307(provisional!,owner,false)).toBe(true);expect(snapshot(provisional!)).toEqual(snapshot(sync));}finally{steps.return(undefined as never);dispose(sync);if(provisional)dispose(provisional);}
});
test('cancellation disposes every provisional allocation exactly once and never publishes a receipt',()=>{
 let provisional:Group|undefined;const steps=createPackedRootStepsV309(owner,'source',false,[row('one'),row('two')],{},root=>{provisional=root;});expect(steps.next().done).toBe(false);
 const mesh=provisional!.children[0] as Mesh;let geometry=0,day=0,night=0,grade=0;mesh.geometry.addEventListener('dispose',()=>geometry++);mesh.userData.dayMaterial.addEventListener('dispose',()=>day++);mesh.userData.nightMaterial.addEventListener('dispose',()=>night++);mesh.userData.schwellenraumMaterial.addEventListener('dispose',()=>grade++);
 steps.return(undefined as never);expect([geometry,day,night,grade]).toEqual([1,1,1,1]);expect(provisional!.children).toHaveLength(0);expect(completePackedRootV307(provisional!,owner)).toBe(false);steps.return(undefined as never);expect([geometry,day,night,grade]).toEqual([1,1,1,1]);
});
test('a later source error cleans earlier meshes and exact optional flat shading is retained',()=>{
 const first=row('one');first.materials={day:{color:[.2,.3,.4],type:'MeshStandardMaterial',side:2,flatShading:true},night:{color:[.1,.2,.3],type:'MeshStandardMaterial',side:2,flatShading:true}};
 const invalid={...row('two'),triangles:0};let provisional:Group|undefined;const steps=createPackedRootStepsV309(owner,'source',false,[first,invalid],{},root=>{provisional=root;});expect(steps.next().done).toBe(false);const mesh=provisional!.children[0] as Mesh;expect(mesh.userData.dayMaterial.flatShading).toBe(true);expect(mesh.userData.nightMaterial.flatShading).toBe(true);let retired=0;mesh.geometry.addEventListener('dispose',()=>retired++);expect(()=>steps.next()).toThrow('Invalid finite');expect(retired).toBe(1);expect(provisional!.children).toHaveLength(0);expect(completePackedRootV307(provisional!,owner)).toBe(false);
});
