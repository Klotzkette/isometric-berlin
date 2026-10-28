import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { build } from 'vite';
import { minifySync } from 'rolldown/experimental';
import { LOSSLESS_EAGER_FIELDS_V282 } from '../losslessEagerFieldsV282';
import { losslessJsonData, READONLY_CONSTRUCTION_JSON_FIELDS, transformLosslessJsonData } from '../losslessJsonData';
import { decodeLosslessGzipJson } from '../src/losslessGzipJson';
import { prepareCityWestTransportV281, type CityWestSourceV281 } from '../src/CityWestTransportV281';
import type { SurroundingCityChunk } from '../src/SurroundingCityGeometry';

const receipts = [
  ['data/citywestTransportV281.json', 'packets', '096ca0fd5151730b90eb392b07f9bccda26d763bbc106fc5c0b0b06e36c4bbaf', '58e97215684e4c8a307923a9376906bb15be109acdd5fc7da6c71579be49f846'],
  ['data/mitteEnsembleV281.json', 'drawn', '751f6f67065b148f32a6771f3c55074f2fd77f9cadeb4d6fda1655c0cbf43a5a', '5c857965a92cec26b7843972f3bd02339983c3c1d7fa40f695ff1e3adfbd9f80'],
  ['data/mitteEnsembleV281.json', 'minecraft', '751f6f67065b148f32a6771f3c55074f2fd77f9cadeb4d6fda1655c0cbf43a5a', 'c390a135efda372a9fe3c5a440519f65b4329854d0b06ac1faf5ac55c6f5b19a'],
  ['data/tramRailsV281.json', 'ground', 'a5264cbf7d3ee5e023866c8953e7e1dfd39f8d92a7cbf4bbf4d1ed435ca1d365', '815323053d307cbd193e8bbdca411c493d78286a3096868144be3dd218d166ee'],
  ['gendarmenmarktPerimeterSource.json', 'buildings', '0e188b948c08a1fa16b48baf5dc11af6ac65b574fd702730cd9ab7ba9d785615', 'd7036a68a111dc585a42c54bbef35e8e2cdf728caea9b78992a7d19557054bcd'],
  ['eastOutlineVoxelData.json', 'cells_i32', '6bceecb6359087263ef72afa31d1fb78d6279154bf9f15939f55d879dc03f57e', '65e2eedea7b09be74664b8236532107995283090581c5ff96550c1d72be3a36a'],
] as const;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
function evaluate(source: string, relative: string) {
  const result = transformLosslessJsonData(source, '/project/src/app/src/' + relative)!;
  expect(result).toBeDefined();
  const script = result.code.replace(/^import[^\n]*\n/, '').replace(/export \{ ([^\n]*) \};/,
    (_match, aliases: string) => `const named={${aliases.split(', ').filter(Boolean).map(alias => {
      const [value, key] = alias.split(' as '); return `[${JSON.stringify(key)}]:${value}`;
    }).join(',')}};`).replace('export default', 'const data=');
  let decodes = 0;
  const decoded = new Function('__decodeLosslessGzip', script + ';return {data,named};')((text: string) => {
    decodes++; return decodeLosslessGzipJson(text);
  });
  return { ...decoded, code: result.code, decodes };
}
function finish<T>(steps: Generator<void, T>): T {
  let result = steps.next(); while (!result.done) result = steps.next(); return result.value;
}

test('six finite eager literals preserve exact source hashes, values, descriptors and strong named identity', () => {
  let saved = 0;
  expect(Object.values(LOSSLESS_EAGER_FIELDS_V282).flat()).toHaveLength(6);
  for (const [relative, fields] of Object.entries(LOSSLESS_EAGER_FIELDS_V282)) {
    const text = readFileSync(new URL('../src/' + relative, import.meta.url), 'utf8');
    const expected = JSON.parse(text), { data, named, code, decodes } = evaluate(text, relative);
    expect(data).toEqual(expected);
    expect(JSON.stringify(data)).toBe(JSON.stringify(expected));
    expect(Object.getOwnPropertyDescriptors(data)).toEqual(Object.getOwnPropertyDescriptors(expected));
    expect(code).not.toContain('WeakRef'); expect(code).not.toContain('get [');
    expect(decodes).toBe(fields.length);
    for (const field of fields) {
      const proof = receipts.find(row => row[0] === relative && row[1] === field)!;
      expect(sha(text)).toBe(proof[2]);
      const json = JSON.stringify(expected[field]);
      expect(sha(json)).toBe(proof[3]);
      expect(sha(JSON.stringify(data[field]))).toBe(proof[3]);
      expect(READONLY_CONSTRUCTION_JSON_FIELDS[relative.replace(/^data\//, '')] ?? []).not.toContain(field);
      expect(named[field]).toBe(data[field]);
      const held = data[field]; held.exactMutation = { preserved: true };
      expect(named[field].exactMutation).toBe(held.exactMutation);
      data[field] = { replacement: true };
      expect(named[field]).toBe(held);
      const packed = gzipSync(json, { level: 9 }).toString('base64');
      saved += minifySync('input.js', 'export const x=' + json + ';', {}).code.length
        - minifySync('input.js', 'export const x=decode(' + JSON.stringify(packed) + ');', {}).code.length;
    }
  }
  expect(saved).toBeGreaterThan(1_400_000);
});

test('eager compression retains negative zero, extreme values, own prototype keys and exact path scope', () => {
  const value = '[-0,1e400,-1e400,5e-324,{"__proto__":{"own":true}},"ä🪁\\n"]';
  for (const [relative, fields] of Object.entries(LOSSLESS_EAGER_FIELDS_V282)) {
    for (const field of fields) {
      const text = `{${JSON.stringify(field)}:[${Array(2000).fill(value).join(',')}]}`;
      const { data, named, decodes } = evaluate(text, relative);
      expect(data).toEqual(JSON.parse(text)); expect(decodes).toBe(1);
      expect(Object.is(data[field][0][0], -0)).toBe(true);
      expect(data[field][0][1]).toBe(Infinity); expect(data[field][0][2]).toBe(-Infinity);
      expect(Object.hasOwn(data[field][0][4], '__proto__')).toBe(true);
      expect(named[field]).toBe(data[field]);
      expect(Object.getOwnPropertyDescriptor(data, field)?.get).toBeUndefined();
      Object.freeze(data); expect(() => { data[field] = []; }).toThrow(TypeError);
      for (const id of ['/project/src/app/public/' + relative, '/project/src/app/src/' + relative + '?raw'])
        expect(transformLosslessJsonData(text, id)).toBeUndefined();
    }
  }
  // Already-compressed RKI arrays remain strong lazy fields. They are not
  // reclassified to eager merely because their source module is large.
  const rki = readFileSync(new URL('../src/data/rkiMoabitV277.json', import.meta.url), 'utf8');
  const result = transformLosslessJsonData(rki, '/project/src/app/src/data/rkiMoabitV277.json')!;
  expect(result.code).toContain('get ["parts"]');
  expect(result.code).toContain('get ["fittingReceipts"]');
  expect(LOSSLESS_EAGER_FIELDS_V282['data/rkiMoabitV277.json']).toBeUndefined();
});

test('the real CityWest consumer prepares unchanged drawn and native transport packets', () => {
  const relative = 'data/citywestTransportV281.json';
  const text = readFileSync(new URL('../src/' + relative, import.meta.url), 'utf8');
  const original = JSON.parse(text) as CityWestSourceV281, decoded = evaluate(text, relative).data as CityWestSourceV281;
  for (const native of [false, true]) {
    const family = native ? 'minecraft' : 'drawn', id = '-12_1', key = family + ':' + id;
    const path = new URL(`../public/mesh/surrounding-berlin-v159/${id}.${family}.json.gz`, import.meta.url);
    const chunk = JSON.parse(gunzipSync(readFileSync(path)).toString()) as SurroundingCityChunk;
    const before = sha(JSON.stringify(chunk));
    const expected = finish(prepareCityWestTransportV281(chunk, id, native, original));
    const actual = finish(prepareCityWestTransportV281(chunk, id, native, decoded));
    expect(actual).not.toBe(chunk);
    expect(actual.meshes.at(-1)).toBe(decoded.packets[key].replacement);
    expect(sha(JSON.stringify(actual))).toBe(sha(JSON.stringify(expected)));
    expect(sha(JSON.stringify(chunk))).toBe(before);
    for (const field of ['positions', 'colors', 'indices'] as const)
      expect(Buffer.from(actual.meshes.at(-1)![field], 'base64'))
        .toEqual(Buffer.from(expected.meshes.at(-1)![field], 'base64'));
  }
});

test('production tree shaking removes unused eager fields and keeps the decoder out of metadata-only startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'isometric-eager-v282-'));
  try {
    const folder = join(directory, 'src/app/src/data'); await mkdir(folder, { recursive: true });
    const path = join(folder, 'citywestTransportV281.json'), entry = join(directory, 'entry.js');
    const text = readFileSync(new URL('../src/data/citywestTransportV281.json', import.meta.url), 'utf8');
    await writeFile(path, text);
    const compile = async (program: string) => {
      await writeFile(entry, program);
      const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: 'silent',
        plugins: [losslessJsonData([])], build: { write: false, minify: true, rolldownOptions: { input: entry } } });
      if (Array.isArray(result) || !('output' in result)) throw Error('Expected fixture output');
      const chunk = result.output.find(item => item.type === 'chunk' && item.isEntry);
      if (!chunk || chunk.type !== 'chunk') throw Error('Missing fixture entry'); return chunk.code;
    };
    const metadata = await compile(`import {schema} from ${JSON.stringify(path)};window.fixture=schema;`);
    expect(metadata.length).toBeLessThan(100);
    const code = await compile(`import data,{packets} from ${JSON.stringify(path)};window.fixture=[data,packets];`);
    let parses = 0;
    const window: { fixture?: [CityWestSourceV281, CityWestSourceV281['packets']] } = {};
    new Function('window', 'JSON', code)(window, { parse(value: string) { parses++; return JSON.parse(value); } });
    expect(parses).toBe(1);
    expect(window.fixture![0].packets).toBe(window.fixture![1]);
    expect(Object.getOwnPropertyDescriptor(window.fixture![0], 'packets')?.get).toBeUndefined();
    expect(window.fixture![0]).toEqual(JSON.parse(text));
    const startup = '../src/data/regierungsviertel-landmarks.json';
    expect(transformLosslessJsonData(readFileSync(new URL(startup, import.meta.url), 'utf8'),
      '/project/src/app/src/data/regierungsviertel-landmarks.json')).toBeUndefined();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
