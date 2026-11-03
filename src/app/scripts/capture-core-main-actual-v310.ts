/** External source capture; the original v307 constructor snapshots stay immutable. */
import {writeFileSync}from'node:fs';
import{InstancedMesh}from'three';
import ts from'typescript';
import{createHash}from'node:crypto';
import{createIsometricCityCore}from'../src/IsometricCityWorld';
import{compactStaticGeometry}from'../src/compactStaticGeometry';
import{cutUbahnPresentationV261}from'../src/UbahnSurfaceAperturesV261';
import{cutUbahnPresentationV281}from'../src/UbahnSurfaceAperturesV281';
import{cutRosenthalerPresentationV228}from'../src/RosenthalerSurfaceAperturesV228';
const B=import.meta.dir+'/../public/mesh/regierungsviertel/',out=process.argv[2];if(!out)throw Error('Explicit external capture path required');
const[prisms,ground,surfaces,scene]=await Promise.all(['lod2-prisms.json','ground-context.json','surface-polygons.json','scene.json'].map(f=>Bun.file(B+f).json()));
const hash=(a:ArrayBufferView)=>{let h=2166136261;for(const c of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^c,16777619)>>>0;return h;};
const b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
// Read the actual production argument/option ABI; never invent a second copy.
const viewerText=await Bun.file(import.meta.dir+'/../src/ThreeViewer.tsx').text(),ast=ts.createSourceFile('ThreeViewer.tsx',viewerText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const calls:ts.CallExpression[]=[];const visit=(n:ts.Node)=>{if(ts.isCallExpression(n)&&n.expression.getText(ast)==='createIsometricCityStepsV309')calls.push(n);ts.forEachChild(n,visit);};visit(ast);if(calls.length!==1)throw Error('Unambiguous actual production initial factory required');const call=calls[0],options=call.arguments[4];if(call.arguments.slice(0,4).map(a=>a.getText(ast)).join('|')!=='prisms|ground|runtime.tunnelPortalCourse|surfaces'||!ts.isObjectLiteralExpression(options))throw Error('Production initial source ABI changed');
const keys=['retainRasterAsphalt','retainRasterWater','smoothSurfaces','parliamentaryDiningV296','waterfrontV296'],expressions:Record<string,string>={},groundOptions:Record<string,unknown>={};for(const key of keys){const p=options.properties.filter(p=>ts.isPropertyAssignment(p)&&p.name.getText(ast)===key);if(p.length!==1||!ts.isPropertyAssignment(p[0]))throw Error('Actual ground option missing: '+key);expressions[key]=p[0].initializer.getText(ast);groundOptions[key]=Function('runtime','surfaces','progressiveInput','fidelityV288','return ('+expressions[key]+')')({coarsePointer:false},surfaces,{}, {parliamentaryDining:true,waterfront:true});}
// Buildings/context do not enter the isolated ground constructor; suppressing
// those unrelated outputs cannot change any ground-source input or row word.
const root=createIsometricCityCore(prisms,ground,scene.tiergartentunnel,surfaces,{...groundOptions,buildings:[],includeContext:false,bridgeStructures:false});
cutUbahnPresentationV261(root,false);cutUbahnPresentationV281(root,false);cutRosenthalerPresentationV228(root,false);root.traverse(compactStaticGeometry);cutUbahnPresentationV261(root,false);cutUbahnPresentationV281(root,false);root.traverse(compactStaticGeometry);root.updateMatrixWorld(true);
const q=root.getObjectByName('Drawn ground slabs')as InstancedMesh;if(!q)throw Error('Missing production main ground');
const attrs=Object.fromEntries(Object.entries(q.geometry.attributes).map(([name,a])=>[name,{array:b64(a.array),type:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,hash:hash(a.array)}]));const day=q.userData.dayMaterial??q.material,night=q.userData.nightMaterial??q.material;
const mat=(m:any)=>({color:m.color.toArray(),type:m.type,vertexColors:m.vertexColors,...(m.roughness===undefined?{}:{roughness:m.roughness}),...(m.metalness===undefined?{}:{metalness:m.metalness}),side:m.side});
const part={name:q.name,parentName:q.parent?.name,position:q.position.toArray(),scale:q.scale.toArray(),matrix:q.matrix.toArray(),attributes:attrs,index:q.geometry.index?{array:b64(q.geometry.index.array),type:q.geometry.index.array.constructor.name,count:q.geometry.index.count,hash:hash(q.geometry.index.array)}:null,instances:{count:q.count,matrix:b64(q.instanceMatrix.array),matrixHash:hash(q.instanceMatrix.array),colors:q.instanceColor?b64(q.instanceColor.array):null,colorHash:q.instanceColor?hash(q.instanceColor.array):null},materials:{day:mat(day),night:mat(night)}};
writeFileSync(out,JSON.stringify({key:'drawn-actual-main',production:'ThreeViewer AST-extracted ground options, real manifest tiergartentunnel, required Rosenthaler aperture then final Ubahn261/281 cuts, compactStaticGeometry',sourceOptions:expressions,sourceOptionsSha256:createHash('sha256').update(options.getText(ast)).digest('hex'),parts:[part]}));console.log(part.name,part.instances.count,part.instances.matrixHash,part.instances.colorHash);
