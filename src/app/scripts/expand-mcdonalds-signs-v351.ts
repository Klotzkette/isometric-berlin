import {readFileSync} from 'node:fs';
import {mcdonaldsSignMeshV351} from '../src/McdonaldsV351';
const rows=JSON.parse(readFileSync(process.argv[2],'utf8'));
console.log(JSON.stringify(Object.fromEntries(rows.map((r:any)=>[r.key,mcdonaldsSignMeshV351(r.plates,r.native)]))));
