// Offline counterfactual proof for the two explicitly transferred v202 owners.
import {plugin} from 'bun';
import {readFileSync} from 'node:fs';
const legacy=process.argv.includes('--legacy'), profile=process.argv.includes('--mobile')?'mobile':'full';
const prefix=`/tmp/v202-native-${legacy?'legacy':'current'}-${profile}`;
if(legacy)plugin({name:'v202-exact-owner-counterfactual',setup(build){
 build.onLoad({filter:/\/MinecraftVoxelWorld\.ts$/},args=>{
  let source=readFileSync(args.path,'utf8');
  for(const name of ['isBendlerblockV202ReplacedColumn','isPergamonPanoramaV202ReplacementColumn']){
   const line=`      !${name}(worldXAbs(xIdx), worldZAbs(zIdx), y0dm / 10, y1dm / 10) &&`;
   if(source.split(line).length!==2)throw new Error('Missing unique predicate '+name);
   source=source.replace(line,'      true && /* exact v202 counterfactual */');
  }
  return {contents:source,loader:'ts'};
 });
}});
const {preloadAltMitteNativeV169Source}=await import('../src/AltMitteNativeCoreV169');
const {createMinecraftVoxelWorld}=await import('../src/MinecraftVoxelWorld');
await preloadAltMitteNativeV169Source();
const payload=await Bun.file(new URL('../public/mesh/regierungsviertel/minecraft-voxels.json',import.meta.url)).json();
const root=createMinecraftVoxelWorld(payload,null,null,{detailProfile:profile});
const baseline=await Bun.file(new URL('../tests/fixtures/minecraft-payload-only-v200.json',import.meta.url)).json();
const result:Record<string,unknown>={};
for(const name of Object.keys(baseline[profile])){
 const mesh:any=root.getObjectByName(name);if(!mesh){result[name]=null;continue;}
 const hash=new Bun.CryptoHasher('sha256').update(mesh.instanceMatrix.array);
 if(mesh.instanceColor)hash.update(mesh.instanceColor.array);
 result[name]={count:mesh.count,sha256:hash.digest('hex')};
 if(['Voxel building columns','Voxel facade windows'].includes(name))for(const k of ['instanceMatrix','instanceColor'])
  if(mesh[k])await Bun.write(prefix+'-'+name.replaceAll(' ','_')+'-'+k+'.bin',mesh[k].array);
}
await Bun.write(prefix+'.json',JSON.stringify(result,null,2)+'\n');
console.log(prefix);
