/** Build-only exact actual predecessor normal/material supplement. */
import {readFileSync,writeFileSync,mkdirSync} from'node:fs';
import {Mesh}from'three';
import {buildSurroundingCityChunk}from'../src/SurroundingCityGeometry';
const dir=process.argv[2];if(!dir)throw Error('Explicit source capture directory required');mkdirSync(dir+'/approach-normals',{recursive:true});
const b64=(v:ArrayBufferView)=>Buffer.from(v.buffer,v.byteOffset,v.byteLength).toString('base64');
const flags={golgathaV270:true,operaTheatresV274:true,mitteEnsembleV281:true,cityWestTransportV281:true,schlossplatzV239:true,staatsoperV240:true,architectureV241:true,prenzlbergV264:true,chariteBridgesV265:true,northernSitesV266:true,moabitLandmarksV269:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true};
for(const tile of['2_-7','3_-7','2_-6','3_-6'])for(const native of[false,true]){
 const mode=native?'minecraft':'drawn',capture=JSON.parse(readFileSync(`${dir}/prepared/${tile}.${mode}.json`,'utf8')),steps=buildSurroundingCityChunk(structuredClone(capture.raw),tile,native,false,flags);let result=steps.next();while(!result.done)result=steps.next();const group=result.value.root,mesh=group.children.find(q=>q instanceof Mesh)as Mesh;
 const logical=(a:any)=>{const result=new a.array.constructor(a.count*a.itemSize),source=a.array,stride=a.data?.stride??a.itemSize,offset=a.offset??0;for(let v=0;v<a.count;v++)for(let c=0;c<a.itemSize;c++)result[v*a.itemSize+c]=source[v*stride+offset+c];return result;};
 if(b64(logical(mesh.geometry.getAttribute('position')))!==capture.mesh.positions||b64(Uint32Array.from(mesh.geometry.index!.array))!==capture.mesh.indices)throw Error('Complete actual old body changed');
 const normals=mesh.geometry.getAttribute('normal');let normalValues:Float32Array|null=null;if(normals){normalValues=new Float32Array(normals.count*3);for(let i=0;i<normals.count;i++)normalValues.set([normals.getX(i),normals.getY(i),normals.getZ(i)],i*3);}

 const material=(m:any)=>({color:m.color.toArray(),type:m.type,vertexColors:m.vertexColors,side:m.side,roughness:m.roughness,metalness:m.metalness,flatShading:m.flatShading});
 writeFileSync(`${dir}/approach-normals/${tile}.${mode}.json`,JSON.stringify({normals:normalValues?b64(normalValues):null,materials:{day:material(mesh.userData.dayMaterial??mesh.material),night:material(mesh.userData.nightMaterial??mesh.material)}}));
 group.traverse(q=>{if(q instanceof Mesh){q.geometry.dispose();for(const m of[q.material,q.userData.dayMaterial,q.userData.nightMaterial])if(m&&'dispose'in m)m.dispose();}});console.log(tile,mode);
}
