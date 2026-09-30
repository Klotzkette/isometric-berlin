import {describe,expect,test} from 'bun:test';
import {createDomAltesMuseum} from '../src/DomAltesMuseum';
import {createUnterDenLindenDetails} from '../src/UnterDenLindenDetails';
import {staticGeometryAudit,disposeStaticAudit} from './helpers/staticGeometryAudit';
import {domAndBowlContributions} from './helpers/altesUnchangedFamily';
import domBaseline from './fixtures/dom-bowl-unchanged-v147.json';
import udlBaseline from './fixtures/unter-den-linden-unaffected-v147.json';
describe('v148 leaves unrelated buildings and monuments byte-for-byte unchanged',()=>{
 test('Dom and granite bowl retain every old source/instance/material in all device geometries',()=>{
  for(const[name,options]of[['drawn',{}],['nativeFull',{minecraft:true}],['nativeMobile',{minecraft:true,mobileLike:true}]]as const){const root=createDomAltesMuseum(options);expect(staticGeometryAudit(domAndBowlContributions(root))).toEqual(domBaseline[name]);disposeStaticAudit(root);}
 });
 test('Aeroflot, Einstein, Dussmann and Komische Oper retain v147 structure and fine detail',()=>{
  const root=createUnterDenLindenDetails();for(const[name,expected]of Object.entries(udlBaseline))expect(staticGeometryAudit(root.getObjectByName(name)!)).toEqual(expected);disposeStaticAudit(root);
 });
});
