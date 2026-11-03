/** Real Three attribute/geometry/object allocation backends with counting GL. */
import {InstancedMesh,Mesh,Line,Points,OrthographicCamera,Scene,type WebGLRenderer}from"three";
import {WebGLAttributes}from"three/src/renderers/webgl/WebGLAttributes.js";
import {WebGLGeometries}from"three/src/renderers/webgl/WebGLGeometries.js";
import {WebGLObjects}from"three/src/renderers/webgl/WebGLObjects.js";
import {createSceneGeometryGpuResidency}from"../../src/sceneGeometryGpuResidency";
import {createSceneGpuResidency}from"../../src/sceneGpuResidency";
export function northGpuHostV309(){
 const scene=new Scene(),camera=new OrthographicCamera(-5,5,5,-5,.1,100);camera.position.set(0,0,10000);camera.lookAt(0,0,9999);camera.updateMatrixWorld(true);
 const uploads:Uint8Array[]=[],live=new Set<object>();let serial=0;
 const gl={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,FLOAT:5126,UNSIGNED_BYTE:5121,BYTE:5120,UNSIGNED_SHORT:5123,SHORT:5122,UNSIGNED_INT:5125,INT:5124,
  createBuffer:()=>{const b={id:serial++};live.add(b);return b;},deleteBuffer:(b:object)=>live.delete(b),bindBuffer:()=>{},
  bufferData:(_target:number,array:ArrayBufferView)=>uploads.push(new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice()),bufferSubData:()=>{}};
 const info={render:{frame:0},memory:{geometries:0}},attributes=WebGLAttributes(gl),states={releaseStatesOfGeometry:()=>{},releaseStatesOfObject:()=>{}},geometries=WebGLGeometries(gl,attributes,info,states),objects=WebGLObjects(gl,geometries,attributes,states,info);
 const renderer={info,domElement:new EventTarget(),getContext:()=>({isContextLost:()=>false}),shadowMap:{enabled:false,type:0,autoUpdate:false,needsUpdate:false},localClippingEnabled:false,clippingPlanes:[]}as unknown as WebGLRenderer;
 const instances=createSceneGpuResidency(renderer,camera,{budgetBytes:0,budgetBuffers:0,graceMs:0,now:()=>0}),geometry=createSceneGeometryGpuResidency(renderer,camera,{budgetBuffers:0,budgetBytes:0,graceMs:0,now:()=>0});
 return{scene,camera,renderer,instances,geometry,uploads,live,
  register(){instances.enqueue(scene);geometry.enqueue(scene);},
  draw(mesh:Mesh|Line|Points){info.render.frame++;objects.update(mesh);if(mesh.geometry.index)attributes.update(mesh.geometry.index,gl.ELEMENT_ARRAY_BUFFER);const m=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;mesh.onAfterRender(renderer,scene,camera,mesh.geometry,m,null);},
  retire(){return{instances:instances.refresh(100,true),geometry:geometry.refresh(100,true)};},
  dispose(){geometry.dispose();instances.dispose();}
 };
}
