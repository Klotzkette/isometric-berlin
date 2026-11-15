import {readFileSync} from 'node:fs';
import {gastronomySignMeshV352} from '../src/GastronomyV352';
const rows=JSON.parse(readFileSync(process.argv[2],'utf8'));
console.log(JSON.stringify(Object.fromEntries(rows.map((r:any)=>[r.key,gastronomySignMeshV352(r.plates,r.native)]))));
