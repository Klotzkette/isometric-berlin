import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FrontSide,InstancedMesh,PerspectiveCamera,Raycaster,Vector2,Vector3} from 'three';
import {createMemorialAccuracyV322,hasCompleteMemorialAccuracyV322} from '../src/MemorialAccuracyV322';
import {prepareMemorialPreviousV322,memorialAccuracySourceRowsV322,type MemorialSiteKeyV322} from '../src/MemorialPreviousV322';
import {createMaisonDeFranceV322,hasCompleteMaisonDeFranceV322} from '../src/MaisonDeFranceV322';
import profile from '../src/data/maisonDeFranceV322.json';
const prism=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/lod2-prisms.json',import.meta.url),'utf8'));
const voxels=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/minecraft-voxels.json',import.meta.url),'utf8'));
// Literal actual typed words captured before the appearance-only corrections.
const previous={
  "berlin": {
    "count": 10402,
    "matrix": "22cd9b7d6583ab53476f1e119bbd2e91a4e95fc33b1ec9acc8cdf8d93d4168b4",
    "color": "d2a0ca8aef26b39bdeb6bddf842710363774afa37080a641b4a1cfe19f83de72"
  },
  "pyramide": {
    "count": 3188,
    "matrix": "e02d8dd05e3254ec68b7a3ddf9e2c5918183a4f3c899bf20f610357771e533ff",
    "color": "cd26b15a2c3cbe061a1c55bc763595c543d3f27110c8fc35e7c7efa100f4c3e0"
  },
  "cadillacs": {
    "count": 185,
    "matrix": "9e919d85ea8eb618121dac60ab5e18416c88acbc38fdf61429aa9d418fc0120e",
    "color": "2fc085a6f05e6c02a09e7127d892ef614c760b2c4c7dc58b3b4560f16c072208"
  },
  "french": {
    "count": 912,
    "matrix": "da65c925a8c3f86afab20f0dffe941f657fb691a85aff7ca38bfc0bdae6b7ae6",
    "color": "cc5378e66cf2fd97dbe91c0afc1ab2f998b4796f9f94dc960e959400aecf6eda"
  },
  "british": {
    "count": 1754,
    "matrix": "8b6c9c4ef45ab540c873e4eb3e2463ebadd1d71c6925036715955f7cfd6e4602",
    "color": "56f181aec415c0b59e4e796586622754559282ee5780c8bd23430e3fdb529168"
  },
  "schoenholz": {
    "count": 856,
    "matrix": "9da22d58f100f42a0d0407a7a1ebc74256e0e7fb6fdfb863e9cffccbd8664fa2",
    "color": "9ca44647849e782a7dc74b52a2121e247ced161a86a54dec5c50534f9e9682a9"
  },
  "treptow": {
    "count": 7040,
    "matrix": "327b2dea84f880f225d664b64ad40066a2b98c13155c0d8fab5791f5c73484dd",
    "color": "766e532456055ee17b2ca098267c78b37b6762ebdc7e451900bacac292dc953d"
  },
  "maison": {
    "count": 3232,
    "matrix": "30df8087db143275fcd0b28c79b4700d46d8514f5aba0344530c94122509d965",
    "color": "86c9a54ead75c37da4c8a272f38a4a394a734f6926214c0216fd8c82b3e6bf99"
  }
} as const;
const sha=(a:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function nativePaint(mesh:InstancedMesh,key:keyof typeof previous){
 expect(mesh.geometry.getAttribute('color')).toBeUndefined();expect(mesh.instanceColor).not.toBe(null);
 for(const material of[mesh.material,mesh.userData.dayMaterial,mesh.userData.nightMaterial,mesh.userData.schwellenraumMaterial]){
  // USE_INSTANCING_COLOR supplies the existing per-instance paint. Enabling
  // USE_COLOR without an attribute multiplies it by WebGL's generic black.
  expect((material as any).vertexColors).toBe(false);expect((material as any).color.getHex()).toBe(0xffffff);
 }
 expect(mesh.count).toBe(previous[key].count);expect(sha(mesh.instanceMatrix.array)).toBe(previous[key].matrix);expect(sha(mesh.instanceColor!.array)).toBe(previous[key].color);
 for(const channel of mesh.instanceColor!.array)expect(channel).toBeGreaterThan(0);
}
test('all seven native memorials and Maison use existing positive instance paint without a missing vertex-colour input',async()=>{
 const keys=['berlin','pyramide','cadillacs','french','british','schoenholz','treptow']as const;
 expect(await prepareMemorialPreviousV322(true,{keys})).toBe(true);const root=createMemorialAccuracyV322(true,{keys,sourceRows:memorialAccuracySourceRowsV322(true,keys)!})!;
 expect(hasCompleteMemorialAccuracyV322(root,true,keys)).toBe(true);for(let i=0;i<keys.length;i++)nativePaint(root.children[i]as InstancedMesh,keys[i]);
 const maison=createMaisonDeFranceV322(true,{sourcePrisms:prism.buildings,voxels})!;expect(hasCompleteMaisonDeFranceV322(maison,true)).toBe(true);nativePaint(maison.children[0]as InstancedMesh,'maison');
});
test('every actual Drawn Maison triangle faces the exterior of its retained source corner',()=>{
 const root=createMaisonDeFranceV322(false,{sourcePrisms:prism.buildings})!,mesh:any=root.children[0],p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal');
 const ring=profile.sourcePrism.ring,area=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0);expect(area).toBeGreaterThan(0);expect(mesh.material.side).toBe(FrontSide);
 const normals=profile.faces.map(i=>{const a=ring[i],b=ring[(i+1)%ring.length],d=new Vector3((b[0]-a[0])/10,0,(b[1]-a[1])/10).normalize();return new Vector3(d.z,0,-d.x);});
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),normal=new Vector3();for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);normal.crossVectors(b.sub(a),c.sub(a)).normalize();expect(Math.max(...normals.map(q=>normal.dot(q)))).toBeGreaterThan(.99);for(let j=0;j<3;j++)expect(new Vector3().fromBufferAttribute(n,i+j).dot(normal)).toBeGreaterThan(.99);}
 expect(hasCompleteMaisonDeFranceV322(root,false)).toBe(true);
});
test('actual exterior cameras hit the Drawn Maison fittings before the unchanged complete Core source walls',async()=>{
 const {createIsometricCityCore}=await import('../src/IsometricCityWorld');const original=prism.buildings.filter((b:any)=>b.id===profile.sourcePrism.id),snapshot=JSON.stringify(original);
 const old=createIsometricCityCore({...prism,buildings:original},null,null,null,{includeContext:false,bridgeStructures:false}),root=createMaisonDeFranceV322(false,{sourcePrisms:prism.buildings})!;old.updateMatrixWorld(true);root.updateMatrixWorld(true);
 for(const i of profile.faces){const a=profile.sourcePrism.ring[i],b=profile.sourcePrism.ring[(i+1)%profile.sourcePrism.ring.length],dx=(b[0]-a[0])/10,dz=(b[1]-a[1])/10,l=Math.hypot(dx,dz),normal=new Vector3(dz/l,0,-dx/l),target=new Vector3((a[0]+b[0])/20,profile.sourcePrism.y0_dm/10+4.1,(a[1]+b[1])/20),camera=new PerspectiveCamera(45,1,.01,50);camera.position.copy(target).addScaledVector(normal,6);camera.lookAt(target);camera.updateMatrixWorld(true);const ray=new Raycaster();ray.setFromCamera(new Vector2(0,0),camera);const fresh=ray.intersectObject(root,true),prior=ray.intersectObject(old,true).filter(h=>(h.object as any).isMesh);expect(fresh.length).toBeGreaterThan(0);expect(prior.length).toBeGreaterThan(0);expect(fresh[0].distance).toBeLessThan(prior[0].distance-.005);}
 expect(JSON.stringify(original)).toBe(snapshot);expect(hasCompleteMaisonDeFranceV322(root,false)).toBe(true);
});
test('unexpected changes to any authored vertex-colour flag revoke each new private material receipt',async()=>{
 for(const native of[false,true]){expect(await prepareMemorialPreviousV322(native,{keys:['schoenholz']})).toBe(true);
  for(const key of['dayMaterial','nightMaterial','schwellenraumMaterial']){
   const memorial=createMemorialAccuracyV322(native,{keys:['schoenholz'],sourceRows:memorialAccuracySourceRowsV322(native,['schoenholz'])!})!,maison=createMaisonDeFranceV322(native,{sourcePrisms:prism.buildings,voxels})!;
   expect(hasCompleteMemorialAccuracyV322(memorial,native,['schoenholz'])).toBe(true);expect(hasCompleteMaisonDeFranceV322(maison,native)).toBe(true);
   for(const root of[memorial,maison]){const material=root.children[0].userData[key];expect(material.vertexColors).toBe(!native);material.vertexColors=!material.vertexColors;}
   expect(hasCompleteMemorialAccuracyV322(memorial,native,['schoenholz'])).toBe(false);expect(hasCompleteMaisonDeFranceV322(maison,native)).toBe(false);
  }
 }
});
