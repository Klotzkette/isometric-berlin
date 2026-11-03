import { expect, test } from "bun:test";
import { createNorthernNavigationV309 } from "../src/NorthernNavigationV309";

test("measured roof slopes, radius clearance and courtyard holes share the complete gate", () => {
  let ready = false;
  const nav = createNorthernNavigationV309([{ ring: [[0, 0], [4, 0], [4, 4], [0, 4]], holes: [[[1, 1], [3, 1], [3, 3], [1, 3]]], minY: 2, maxY: 8, topAt: x => 4 + x }], () => ready);
  expect(nav.solidAt(.5, 3, .5)).toBeFalse(); expect(nav.floorAt(.5, .5, 4)).toBeNull();
  ready = true;
  expect(nav.solidAt(.5, 4.4, .5)).toBeTrue(); expect(nav.solidAt(.5, 4.6, .5)).toBeFalse();
  expect(nav.solidAt(-.1, 3.99, .5, .2)).toBeTrue(); expect(nav.solidAt(-.1, 4.01, .5, .2)).toBeFalse();
  expect(nav.solidAt(-.21, 3, .5, .2)).toBeFalse();
  expect(nav.solidAt(2, 3, 2)).toBeFalse(); expect(nav.solidAt(1.1, 3, 2, .2)).toBeTrue();
  expect(nav.solidAt(1.1, 5.01, 2, .2)).toBeFalse();
  expect(nav.floorAt(.5, .5, 4)).toBe(4.5); expect(nav.floorAt(2, 2, 4)).toBeNull();
  ready = false;
  expect(nav.solidAt(.5, 3, .5)).toBeFalse(); expect(nav.floorAt(.5, .5, 4)).toBeNull();
});

test("native steps keep their independent actual tops and open platform air", () => {
  const nav = createNorthernNavigationV309([
    { ring: [[31, 0], [32, 0], [32, 1], [31, 1]], minY: 10, maxY: 10.5 },
    { ring: [[32, 0], [33, 0], [33, 1], [32, 1]], minY: 10, maxY: 11 },
    { ring: [[31, 0], [33, 0], [33, 1], [31, 1]], minY: 16, maxY: 16.25 },
  ], () => true);
  expect(nav.floorAt(31.5, .5, 10)).toBe(10.5); expect(nav.floorAt(32.5, .5, 10.5)).toBe(11);
  expect(nav.solidAt(32.5, 10.9, .5)).toBeTrue(); expect(nav.solidAt(31.5, 10.9, .5)).toBeFalse();
  expect(nav.solidAt(31.5, 14, .5)).toBeFalse(); expect(nav.solidAt(31.5, 16.1, .5)).toBeTrue();
  expect(nav.solidAt(30.9, 10.4, .5, .2)).toBeTrue();
});


test("sloped bridge decks use their actual thin underside at each point",()=>{
  const nav=createNorthernNavigationV309([{ring:[[0,0],[20,0],[20,4],[0,4]],minY:9.5,maxY:20,topAt:(x)=>10+x/2,bottomAt:(x)=>9.5+x/2}],()=>true);
  expect(nav.solidAt(18,15,2)).toBeFalse();
  expect(nav.solidAt(18,18.75,2)).toBeTrue();
  expect(nav.solidAt(18,19.5,2)).toBeFalse();
  expect(nav.floorAt(18,2,19)).toBe(19);
});


test("visible measured ground wins over a lower platform while elevated roofs remain walkable",()=>{
  let complete=true;
  const nav=createNorthernNavigationV309([{ring:[[0,0],[4,0],[4,4],[0,4]],minY:11,maxY:11.96},{ring:[[0,0],[4,0],[4,4],[0,4]],minY:18.5,maxY:19}],()=>complete,()=>12.34);
  expect(nav.floorAt(2,2,12.34)).toBe(12.34);
  expect(nav.floorAt(2,2,19)).toBe(19);
  expect(nav.floorAt(2,2,25)).toBeNull();
  complete=false;expect(nav.floorAt(2,2,12.34)).toBeNull();
});
