import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {prepareNordMauerparkV266} from '/Users/klotzkette/Desktop/Codex Projects/isometric-berlin/src/app/src/NordMauerparkV266';
import {prepareRoofHouseV233} from '/Users/klotzkette/Desktop/Codex Projects/isometric-berlin/src/app/src/roofHouseV233';
import {prepareHouseDoorsV233} from '/Users/klotzkette/Desktop/Codex Projects/isometric-berlin/src/app/src/houseDoorsV233';
import {prepareCityStreetsV249} from '/Users/klotzkette/Desktop/Codex Projects/isometric-berlin/src/app/src/CityStreetsV249';
import {prepareStreetCurvesV276} from '/Users/klotzkette/Desktop/Codex Projects/isometric-berlin/src/app/src/streetCurvesV276';
const dir=process.argv[2];if(!dir)throw Error('Expected external prepared output directory');mkdirSync(dir,{recursive:true});
for(const id of ['3_-6','3_-5','4_-6','4_-5'])for(const native of [false,true]){
const mode=native?'minecraft':'drawn';let p=JSON.parse(gunzipSync(readFileSync(`/Users/klotzkette/Desktop/Codex Projects/isometric-berlin/src/app/public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`)).toString());
for(const f of [prepareNordMauerparkV266,prepareRoofHouseV233,prepareHouseDoorsV233,prepareCityStreetsV249,prepareStreetCurvesV276]){const gen=f(p,id,native);let r=gen.next();while(!r.done)r=gen.next();p=r.value;}
writeFileSync(`${dir}/${id}.${mode}.json`,JSON.stringify(p));console.log(id,mode,p.meshes.map(m=>m.kind));}
